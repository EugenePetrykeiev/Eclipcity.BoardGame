mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = {
      account_id = "123456789012"
      arn        = "arn:aws:iam::123456789012:user/terraform-test"
      user_id    = "AIDATEST"
    }
  }

  mock_data "aws_availability_zones" {
    defaults = {
      names    = ["eu-central-1a", "eu-central-1b"]
      zone_ids = ["euc1-az2", "euc1-az3"]
    }
  }

  mock_data "aws_ssm_parameter" {
    defaults = {
      name  = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
      type  = "String"
      value = "ami-0123456789abcdef0"
    }
  }

  mock_data "aws_instance" {
    defaults = {
      id                     = "i-02bf5a28818374a1c"
      instance_id            = "i-02bf5a28818374a1c"
      private_ip             = "172.31.8.141"
      subnet_id              = "subnet-0027566d83a257d07"
      vpc_security_group_ids = ["sg-09b030b01fdfd4f39"]
    }
  }

  mock_data "aws_subnet" {
    defaults = {
      id         = "subnet-0027566d83a257d07"
      cidr_block = "172.31.0.0/20"
      vpc_id     = "vpc-0b4438217b4166a48"
    }
  }

  mock_data "aws_vpc" {
    defaults = {
      id         = "vpc-0b4438217b4166a48"
      cidr_block = "172.31.0.0/16"
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      id            = "terraform-test-policy"
      json          = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
      minified_json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

variables {
  backend_secret_arn = "arn:aws:secretsmanager:eu-central-1:123456789012:secret:eclipcity/dev/backend-test"
  budget_alert_email = "alerts@example.com"
}

run "plan_dev_offline" {
  command = plan

  assert {
    condition     = var.domain_name == "dev.eclipcity.digitee.space"
    error_message = "The dev root must retain the expected application domain."
  }

  assert {
    condition     = length(module.vpc.public_subnet_ids) == 2 && length(module.vpc.private_subnet_ids) == 2
    error_message = "The dev VPC must retain two public and two private subnets."
  }

  assert {
    condition     = var.private_database_hostname == "postgres.internal.dev.eclipcity.digitee.space"
    error_message = "The backend must use the stable private database hostname."
  }

  assert {
    condition     = var.frontend_instance_type == "t4g.micro" && var.backend_instance_type == "t4g.micro"
    error_message = "Free Tier-oriented dev must default both application nodes to t4g.micro."
  }

  assert {
    condition     = var.enable_nat_gateway == false && module.vpc.nat_gateway_public_ip == null
    error_message = "Free Tier-oriented dev must not create a NAT Gateway by default."
  }

  assert {
    condition     = module.budget.name == "eclipcity-dev-monthly-cost"
    error_message = "A monthly AWS Budget must be created when an alert email is configured."
  }
}
