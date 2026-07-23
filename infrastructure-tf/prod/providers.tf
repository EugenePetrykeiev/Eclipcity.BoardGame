provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = local.common_tags
  }
}

data "aws_caller_identity" "current" {}

data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_instance" "database" {
  instance_id = var.database_instance_id
}

data "aws_subnet" "database" {
  id = data.aws_instance.database.subnet_id
}

data "aws_vpc" "database" {
  id = data.aws_subnet.database.vpc_id
}
