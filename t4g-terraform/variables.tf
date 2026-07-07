variable "aws_region" {
  description = "AWS Region where the EC2 instance will be created."
  type        = string
  default     = "eu-central-1"
}

variable "instance_name" {
  description = "Name tag for the EC2 instance."
  type        = string
  default     = "postgres-t4g-micro"
}

variable "instance_type" {
  description = "ARM-based Graviton EC2 instance type."
  type        = string
  default     = "t4g.micro"
}

variable "key_name" {
  description = "AWS EC2 key pair name that Terraform will create from your public key."
  type        = string
  default     = "pg-t4g-key"
}

variable "public_key_path" {
  description = "Path to the local SSH public key to import into EC2."
  type        = string
  default     = "./pg-t4g-key.pub"
}

variable "private_key_path" {
  description = "Path to the matching private key, used only to print the SSH command."
  type        = string
  default     = "./pg-t4g-key"
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to SSH to the instance, for example 203.0.113.10/32."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.ssh_allowed_cidr))
    error_message = "ssh_allowed_cidr must be a valid CIDR block, for example 203.0.113.10/32."
  }
}

variable "postgres_allowed_cidr" {
  description = "CIDR allowed to connect to PostgreSQL on port 5432."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.postgres_allowed_cidr))
    error_message = "postgres_allowed_cidr must be a valid CIDR block, for example 203.0.113.10/32."
  }
}

variable "root_volume_size_gb" {
  description = "Root EBS volume size in GiB."
  type        = number
  default     = 20

  validation {
    condition     = var.root_volume_size_gb >= 8
    error_message = "root_volume_size_gb must be at least 8."
  }
}

variable "db_secret_name" {
  description = "Name of the AWS Secrets Manager secret containing PostgreSQL dbname, username, and password."
  type        = string
  default     = "postgres/t4g/app"
}
