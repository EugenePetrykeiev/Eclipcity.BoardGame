locals {
  instance_roles = toset(["frontend", "backend"])
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  for_each = local.instance_roles

  name               = "${var.name_prefix}-${each.key}-ec2"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
  tags = merge(var.tags, {
    Role = each.key
  })
}

resource "aws_iam_instance_profile" "instance" {
  for_each = local.instance_roles

  name = "${var.name_prefix}-${each.key}"
  role = aws_iam_role.instance[each.key].name
  tags = merge(var.tags, {
    Role = each.key
  })
}

resource "aws_iam_role_policy_attachment" "ssm" {
  for_each = local.instance_roles

  role       = aws_iam_role.instance[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "ecr_read_only" {
  for_each = local.instance_roles

  role       = aws_iam_role.instance[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

data "aws_iam_policy_document" "backend_secret" {
  statement {
    sid       = "ReadBackendSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.backend_secret_arn]
  }

  dynamic "statement" {
    for_each = var.backend_secret_kms_key_arn == null ? [] : [var.backend_secret_kms_key_arn]

    content {
      sid       = "DecryptBackendSecret"
      actions   = ["kms:Decrypt"]
      resources = [statement.value]
    }
  }
}

resource "aws_iam_policy" "backend_secret" {
  name        = "${var.name_prefix}-backend-secret-read"
  description = "Read only the configured ${var.name_prefix} backend secret"
  policy      = data.aws_iam_policy_document.backend_secret.json
  tags        = var.tags
}

resource "aws_iam_role_policy_attachment" "backend_secret" {
  role       = aws_iam_role.instance["backend"].name
  policy_arn = aws_iam_policy.backend_secret.arn
}
