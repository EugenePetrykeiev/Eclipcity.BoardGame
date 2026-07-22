variable "aws_region" {
  description = "AWS region for the dev environment."
  type        = string
  default     = "eu-central-1"
}

variable "aws_account_id" {
  description = "AWS account allowed for this environment; prevents accidental cross-account apply."
  type        = string
  default     = "396287094980"
}

variable "project" {
  description = "Stable project slug used in names and tags."
  type        = string
  default     = "eclipcity"

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.project))
    error_message = "project must contain only lowercase letters, digits, and hyphens."
  }
}

variable "environment" {
  description = "Environment slug. This root module is intentionally limited to dev."
  type        = string
  default     = "dev"

  validation {
    condition     = var.environment == "dev"
    error_message = "The infrastructure-tf/dev root may only manage the dev environment."
  }
}

variable "domain_name" {
  description = "Public application domain."
  type        = string
  default     = "dev.eclipcity.digitee.space"
}

variable "owner" {
  description = "Team or person responsible for the resources."
  type        = string
  default     = "platform"
}

variable "cost_center" {
  description = "Value used for AWS cost allocation."
  type        = string
  default     = "eclipcity"
}

variable "repository" {
  description = "Repository name recorded on all supported AWS resources."
  type        = string
  default     = "Cartahena"
}

variable "github_repository" {
  description = "GitHub repository trusted by AWS OIDC in owner/name format."
  type        = string
  default     = "EugenePetrykeiev/Eclipcity"

  validation {
    condition     = can(regex("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", var.github_repository))
    error_message = "github_repository must use owner/name format."
  }
}

variable "github_environment" {
  description = "GitHub Environment used by automatic dev deployments."
  type        = string
  default     = "dev"
}

variable "github_oidc_subject_override" {
  description = "Optional exact GitHub OIDC subject, for example after opting into immutable repository IDs."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition = (
      var.github_oidc_subject_override == null ||
      can(regex("^repo:.+:environment:[A-Za-z0-9_.-]+$", var.github_oidc_subject_override))
    )
    error_message = "github_oidc_subject_override must be null or an exact repository environment subject."
  }
}

variable "extra_tags" {
  description = "Additional non-secret tags applied through the AWS provider."
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR of the isolated dev VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "One public subnet CIDR per availability zone."
  type        = list(string)
  default     = ["10.20.0.0/24", "10.20.1.0/24"]

  validation {
    condition     = length(var.public_subnet_cidrs) == 2
    error_message = "Exactly two public subnet CIDRs are required."
  }
}

variable "private_subnet_cidrs" {
  description = "One private application subnet CIDR per availability zone."
  type        = list(string)
  default     = ["10.20.10.0/24", "10.20.11.0/24"]

  validation {
    condition     = length(var.private_subnet_cidrs) == 2
    error_message = "Exactly two private subnet CIDRs are required."
  }
}

variable "enable_nat_gateway" {
  description = "Create a paid NAT Gateway for private subnet egress. Disabled for Free Tier-oriented dev."
  type        = bool
  default     = false
}

variable "frontend_instance_type" {
  description = "ARM-based EC2 type for the frontend/edge node."
  type        = string
  default     = "t4g.micro"
}

variable "backend_instance_type" {
  description = "ARM-based EC2 type for the backend node."
  type        = string
  default     = "t4g.micro"
}

variable "root_volume_size_gb" {
  description = "Encrypted gp3 root volume size for each EC2 instance."
  type        = number
  default     = 20

  validation {
    condition     = var.root_volume_size_gb >= 8
    error_message = "root_volume_size_gb must be at least 8 GB."
  }
}

variable "backend_port" {
  description = "Private backend listener exposed only to the frontend security group."
  type        = number
  default     = 8000

  validation {
    condition     = var.backend_port >= 1024 && var.backend_port <= 65535
    error_message = "backend_port must be between 1024 and 65535."
  }
}

variable "backend_secret_arn" {
  description = "Existing Secrets Manager secret ARN for the dev backend."
  type        = string
  default     = "arn:aws:secretsmanager:eu-central-1:396287094980:secret:eclipcity/dev/backend-UCILpp"

  validation {
    condition     = can(regex("^arn:aws[a-z-]*:secretsmanager:", var.backend_secret_arn))
    error_message = "backend_secret_arn must be a Secrets Manager ARN."
  }
}

variable "database_instance_id" {
  description = "Existing PostgreSQL EC2 instance connected through private VPC peering."
  type        = string
  default     = "i-02bf5a28818374a1c"

  validation {
    condition     = can(regex("^i-[0-9a-f]+$", var.database_instance_id))
    error_message = "database_instance_id must be a valid EC2 instance ID."
  }
}

variable "database_instance_role_name" {
  description = "IAM role already attached to the existing PostgreSQL EC2; Terraform grants it SSM management access."
  type        = string
  default     = "postgres-t4g-micro-ec2-role"

  validation {
    condition     = can(regex("^[A-Za-z0-9+=,.@_-]{1,64}$", var.database_instance_role_name))
    error_message = "database_instance_role_name must be a valid IAM role name."
  }
}

variable "database_security_group_id" {
  description = "Existing PostgreSQL security group that receives a backend-only ingress rule."
  type        = string
  default     = "sg-09b030b01fdfd4f39"

  validation {
    condition     = can(regex("^sg-[0-9a-f]+$", var.database_security_group_id))
    error_message = "database_security_group_id must be a valid security group ID."
  }
}

variable "database_route_table_id" {
  description = "Existing main route table used implicitly by the PostgreSQL subnet."
  type        = string
  default     = "rtb-0bd8444443bb801b4"

  validation {
    condition     = can(regex("^rtb-[0-9a-f]+$", var.database_route_table_id))
    error_message = "database_route_table_id must be a valid route table ID."
  }
}

variable "database_port" {
  description = "PostgreSQL listener port on the existing database EC2."
  type        = number
  default     = 5432
}

variable "private_database_hostname" {
  description = "Stable private Route 53 hostname exposed only inside the dev VPC."
  type        = string
  default     = "postgres.internal.dev.eclipcity.digitee.space"
}

variable "private_backend_hostname" {
  description = "Stable private Route 53 hostname used by frontend nginx for backend traffic."
  type        = string
  default     = "backend.internal.dev.eclipcity.digitee.space"
}

variable "docker_compose_version" {
  description = "Pinned Docker Compose plugin release installed on ARM64 EC2 nodes."
  type        = string
  default     = "v5.1.4"

  validation {
    condition     = can(regex("^v[0-9]+\\.[0-9]+\\.[0-9]+$", var.docker_compose_version))
    error_message = "docker_compose_version must be a full vMAJOR.MINOR.PATCH release."
  }
}

variable "ecr_retained_release_count" {
  description = "Number of immutable releases retained in each application ECR repository."
  type        = number
  default     = 10

  validation {
    condition     = var.ecr_retained_release_count >= 3
    error_message = "ecr_retained_release_count must retain at least three releases."
  }
}

variable "backend_secret_kms_key_arn" {
  description = "Optional customer-managed KMS key ARN used by the existing backend secret."
  type        = string
  default     = null
  nullable    = true
}

variable "enable_detailed_monitoring" {
  description = "Enable EC2 one-minute monitoring (adds cost)."
  type        = bool
  default     = false
}

variable "enable_vpc_flow_logs" {
  description = "Send accepted and rejected VPC flow logs to CloudWatch Logs."
  type        = bool
  default     = true
}

variable "vpc_flow_log_retention_days" {
  description = "CloudWatch retention for VPC flow logs."
  type        = number
  default     = 30
}

variable "enable_ses_identity" {
  description = "Create SES domain identity and output the DNS verification records."
  type        = bool
  default     = true
}

variable "monthly_budget_limit_usd" {
  description = "Account-level monthly AWS cost budget used to protect dev Free Tier credits."
  type        = number
  default     = 25

  validation {
    condition     = var.monthly_budget_limit_usd > 0
    error_message = "monthly_budget_limit_usd must be greater than zero."
  }
}

variable "budget_alert_email" {
  description = "Email receiving AWS Budget alerts. Set via terraform.tfvars or TF_VAR_budget_alert_email."
  type        = string
  nullable    = false
  sensitive   = true

  validation {
    condition     = can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.budget_alert_email))
    error_message = "budget_alert_email must be a valid email address."
  }
}

variable "certbot_email" {
  description = "Optional Let's Encrypt contact email. Defaults to budget_alert_email."
  type        = string
  default     = null
  nullable    = true
  sensitive   = true

  validation {
    condition = (
      var.certbot_email == null ||
      can(regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.certbot_email))
    )
    error_message = "certbot_email must be null or a valid email address."
  }
}
