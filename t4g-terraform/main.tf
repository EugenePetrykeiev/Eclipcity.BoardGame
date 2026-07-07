provider "aws" {
  region = var.aws_region
}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_secretsmanager_secret" "postgres_credentials" {
  name = var.db_secret_name
}

data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRole"
    ]

    principals {
      type = "Service"

      identifiers = [
        "ec2.amazonaws.com"
      ]
    }
  }
}

resource "aws_iam_role" "postgres_ec2" {
  name               = "${var.instance_name}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json
}

resource "aws_iam_role_policy" "read_postgres_secret" {
  name = "${var.instance_name}-read-db-secret"
  role = aws_iam_role.postgres_ec2.name

  policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Action = [
          "secretsmanager:GetSecretValue"
        ]

        Resource = data.aws_secretsmanager_secret.postgres_credentials.arn
      }
    ]
  })
}

resource "aws_iam_instance_profile" "postgres" {
  name = "${var.instance_name}-instance-profile"
  role = aws_iam_role.postgres_ec2.name
}

resource "aws_key_pair" "postgres" {
  key_name   = var.key_name
  public_key = file(var.public_key_path)
}

resource "aws_security_group" "postgres" {
  name        = "${var.instance_name}-sg"
  description = "Security group for PostgreSQL EC2 instance"
  vpc_id      = data.aws_vpc.default.id

  tags = {
    Name = "${var.instance_name}-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.postgres.id
  description       = "SSH from allowed CIDR"
  cidr_ipv4         = var.ssh_allowed_cidr
  from_port         = 22
  ip_protocol       = "tcp"
  to_port           = 22
}

resource "aws_vpc_security_group_ingress_rule" "postgres" {
  security_group_id = aws_security_group.postgres.id
  description       = "PostgreSQL from allowed CIDR"
  cidr_ipv4         = var.postgres_allowed_cidr
  from_port         = 5432
  ip_protocol       = "tcp"
  to_port           = 5432
}

resource "aws_vpc_security_group_egress_rule" "all_outbound_ipv4" {
  security_group_id = aws_security_group.postgres.id
  description       = "Allow all outbound IPv4 traffic"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_instance" "postgres" {
  ami                         = data.aws_ssm_parameter.al2023_arm64.value
  instance_type               = var.instance_type
  subnet_id                   = sort(data.aws_subnets.default.ids)[0]
  vpc_security_group_ids      = [aws_security_group.postgres.id]
  key_name                    = aws_key_pair.postgres.key_name
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.postgres.name

  user_data = templatefile("${path.module}/user_data.sh.tftpl", {
  aws_region           = var.aws_region
  db_secret_arn        = data.aws_secretsmanager_secret.postgres_credentials.arn
  postgres_client_cidr = var.postgres_allowed_cidr
  })

  user_data_replace_on_change = true

  root_block_device {
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_tokens = "required"
  }

  depends_on = [
  aws_iam_role_policy.read_postgres_secret
  ]

  tags = {
    Name = var.instance_name
  }
}

