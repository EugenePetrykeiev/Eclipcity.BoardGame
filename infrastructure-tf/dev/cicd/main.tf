locals {
  components = toset(["backend", "certbot", "deploy", "frontend", "nginx"])

  github_subject = coalesce(
    var.github_oidc_subject,
    "repo:${var.github_repository}:environment:${var.github_environment}",
  )
}

resource "aws_ecr_repository" "application" {
  for_each = local.components

  name                 = "${var.project}/${var.environment}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = false

  encryption_configuration {
    encryption_type = "AES256"
  }

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, {
    Name      = "${var.name_prefix}-${each.key}"
    Component = each.key
  })
}

resource "aws_ecr_lifecycle_policy" "application" {
  for_each = aws_ecr_repository.application

  repository = each.value.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after one day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep the latest ${var.retained_release_count} immutable releases"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["git-"]
          countType     = "imageCountMoreThan"
          countNumber   = var.retained_release_count
        }
        action = {
          type = "expire"
        }
      },
    ]
  })
}

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]

  tags = merge(var.tags, {
    Name = "${var.name_prefix}-github-actions"
  })
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    sid     = "GitHubActionsEnvironment"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_subject]
    }
  }
}

resource "aws_iam_role" "github_build" {
  name                 = "${var.name_prefix}-github-build"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 3600
  tags                 = var.tags
}

data "aws_iam_policy_document" "github_build" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }

  statement {
    sid = "PushApplicationImages"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:GetDownloadUrlForLayer",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [for repository in aws_ecr_repository.application : repository.arn]
  }
}

resource "aws_iam_role_policy" "github_build" {
  name   = "push-application-images"
  role   = aws_iam_role.github_build.id
  policy = data.aws_iam_policy_document.github_build.json
}

resource "aws_ssm_document" "backend" {
  name            = "${var.name_prefix}-deploy-backend"
  document_type   = "Command"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Deploy an immutable Eclipcity backend image and run Alembic migrations"
    parameters = {
      ImageUri = {
        type              = "String"
        description       = "Immutable ECR backend image URI including sha256 digest"
        allowedPattern    = "^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
      ReleaseId = {
        type              = "String"
        description       = "Auditable GitHub release identifier"
        allowedPattern    = "^[A-Za-z0-9._-]{7,160}$"
        interpolationType = "ENV_VAR"
      }
      BundleImageUri = {
        type              = "String"
        description       = "Immutable ECR deployment bundle image URI including sha256 digest"
        allowedPattern    = "^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
    }
    mainSteps = [
      {
        action = "aws:runShellScript"
        name   = "deployBackend"
        inputs = {
          timeoutSeconds = "900"
          runCommand = [
            "set -Eeuo pipefail",
            "install -d -o root -g root -m 0755 /opt/eclipcity/backend /opt/eclipcity/bin",
            "bundle_registry=$(printf '%s' \"$SSM_BundleImageUri\" | cut -d/ -f1)",
            "trap 'docker logout \"$bundle_registry\" >/dev/null 2>&1 || true' EXIT",
            "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin \"$bundle_registry\" >/dev/null",
            "docker pull \"$SSM_BundleImageUri\"",
            "docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges -v /opt/eclipcity:/target \"$SSM_BundleImageUri\" backend",
            "/opt/eclipcity/bin/deploy-backend \"$SSM_ImageUri\" \"$SSM_ReleaseId\" \"${var.public_domain}\"",
          ]
        }
      },
    ]
  })

  tags = var.tags
}

resource "aws_ssm_document" "frontend" {
  name            = "${var.name_prefix}-deploy-frontend"
  document_type   = "Command"
  document_format = "JSON"

  content = jsonencode({
    schemaVersion = "2.2"
    description   = "Deploy immutable Eclipcity frontend and nginx images"
    parameters = {
      FrontendImageUri = {
        type              = "String"
        description       = "Immutable ECR frontend image URI including sha256 digest"
        allowedPattern    = "^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
      NginxImageUri = {
        type              = "String"
        description       = "Immutable ECR nginx image URI including sha256 digest"
        allowedPattern    = "^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
      CertbotImageUri = {
        type              = "String"
        description       = "Immutable ECR certbot image URI including sha256 digest"
        allowedPattern    = "^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
      ReleaseId = {
        type              = "String"
        description       = "Auditable GitHub release identifier"
        allowedPattern    = "^[A-Za-z0-9._-]{7,160}$"
        interpolationType = "ENV_VAR"
      }
      BundleImageUri = {
        type              = "String"
        description       = "Immutable ECR deployment bundle image URI including sha256 digest"
        allowedPattern    = "^[0-9]{12}\\.dkr\\.ecr\\.[a-z0-9-]+\\.amazonaws\\.com/.+@sha256:[a-f0-9]{64}$"
        interpolationType = "ENV_VAR"
      }
    }
    mainSteps = [
      {
        action = "aws:runShellScript"
        name   = "deployFrontend"
        inputs = {
          timeoutSeconds = "900"
          runCommand = [
            "set -Eeuo pipefail",
            "install -d -o root -g root -m 0755 /opt/eclipcity/frontend /opt/eclipcity/bin",
            "bundle_registry=$(printf '%s' \"$SSM_BundleImageUri\" | cut -d/ -f1)",
            "trap 'docker logout \"$bundle_registry\" >/dev/null 2>&1 || true' EXIT",
            "aws ecr get-login-password --region ${var.aws_region} | docker login --username AWS --password-stdin \"$bundle_registry\" >/dev/null",
            "docker pull \"$SSM_BundleImageUri\"",
            "docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges -v /opt/eclipcity:/target \"$SSM_BundleImageUri\" frontend",
            "/opt/eclipcity/bin/deploy-frontend \"$SSM_FrontendImageUri\" \"$SSM_NginxImageUri\" \"$SSM_CertbotImageUri\" \"$SSM_ReleaseId\" \"${var.backend_private_hostname}:${var.backend_port}\" \"${var.public_domain}\" \"${var.certificate_email}\"",
          ]
        }
      },
    ]
  })

  tags = var.tags
}

resource "aws_ssm_parameter" "instance_id" {
  for_each = {
    backend  = var.backend_instance_id
    frontend = var.frontend_instance_id
  }

  name        = "/${var.project}/${var.environment}/cicd/${each.key}-instance-id"
  description = "Current ${each.key} EC2 target managed by Terraform"
  type        = "String"
  value       = each.value

  tags = merge(var.tags, {
    Role = each.key
  })
}

resource "aws_iam_role" "github_deploy" {
  for_each = toset(["backend", "frontend"])

  name                 = "${var.name_prefix}-github-deploy-${each.key}"
  assume_role_policy   = data.aws_iam_policy_document.github_assume.json
  max_session_duration = 3600

  tags = merge(var.tags, {
    Role = each.key
  })
}

data "aws_iam_policy_document" "github_deploy" {
  for_each = {
    backend = {
      instance_id   = var.backend_instance_id
      document_arn  = aws_ssm_document.backend.arn
      parameter_arn = aws_ssm_parameter.instance_id["backend"].arn
    }
    frontend = {
      instance_id   = var.frontend_instance_id
      document_arn  = aws_ssm_document.frontend.arn
      parameter_arn = aws_ssm_parameter.instance_id["frontend"].arn
    }
  }

  statement {
    sid     = "RunRoleSpecificDeployment"
    actions = ["ssm:SendCommand"]
    resources = [
      each.value.document_arn,
      "arn:aws:ec2:${var.aws_region}:${var.aws_account_id}:instance/${each.value.instance_id}",
    ]
  }

  statement {
    sid       = "ReadDeploymentTarget"
    actions   = ["ssm:GetParameter"]
    resources = [each.value.parameter_arn]
  }

  statement {
    sid = "ObserveDeploymentCommand"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
      "ssm:ListCommands",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  for_each = data.aws_iam_policy_document.github_deploy

  name   = "deploy-${each.key}-through-ssm"
  role   = aws_iam_role.github_deploy[each.key].id
  policy = each.value.json
}
