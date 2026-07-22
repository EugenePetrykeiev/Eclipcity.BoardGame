variable "name_prefix" {
  description = "Prefix used for CI/CD resource names."
  type        = string
}

variable "project" {
  description = "Project slug used in ECR and Parameter Store paths."
  type        = string
}

variable "environment" {
  description = "Deployment environment slug."
  type        = string
}

variable "aws_region" {
  description = "AWS region containing ECR, SSM, and EC2 resources."
  type        = string
}

variable "aws_account_id" {
  description = "AWS account trusted by deterministic IAM resource ARNs."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository in owner/name format trusted by OIDC."
  type        = string
}

variable "github_environment" {
  description = "GitHub Environment encoded in the OIDC subject."
  type        = string
}

variable "github_oidc_subject" {
  description = "Optional exact GitHub OIDC subject override."
  type        = string
  nullable    = true
}

variable "frontend_instance_id" {
  description = "Current frontend EC2 deployment target."
  type        = string
}

variable "backend_instance_id" {
  description = "Current backend EC2 deployment target."
  type        = string
}

variable "backend_private_hostname" {
  description = "Private backend hostname used by nginx."
  type        = string
}

variable "backend_port" {
  description = "Backend port reachable only from the frontend security group."
  type        = number
}

variable "public_domain" {
  description = "Public application domain configured in nginx."
  type        = string
}

variable "retained_release_count" {
  description = "Number of immutable image releases retained per ECR repository."
  type        = number
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
