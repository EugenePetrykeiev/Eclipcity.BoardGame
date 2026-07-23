variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "environment" {
  description = "Deployment environment recorded in the node configuration."
  type        = string
}

variable "aws_region" {
  description = "AWS region recorded in the node configuration."
  type        = string
}

variable "domain_name" {
  description = "Public application domain recorded in the node configuration."
  type        = string
}

variable "ami_id" {
  description = "Amazon Linux 2023 ARM64 AMI ID."
  type        = string
}

variable "frontend_instance_type" {
  description = "Frontend EC2 instance type."
  type        = string
}

variable "backend_instance_type" {
  description = "Backend EC2 instance type."
  type        = string
}

variable "frontend_subnet_id" {
  description = "Public subnet for the frontend node."
  type        = string
}

variable "backend_subnet_id" {
  description = "Public subnet for the backend node; its security group still denies public ingress."
  type        = string
}

variable "frontend_security_group_id" {
  description = "Frontend security group ID."
  type        = string
}

variable "backend_security_group_id" {
  description = "Backend security group ID."
  type        = string
}

variable "frontend_instance_profile" {
  description = "Frontend IAM instance profile name."
  type        = string
}

variable "backend_instance_profile" {
  description = "Backend IAM instance profile name."
  type        = string
}

variable "root_volume_size_gb" {
  description = "Root volume size."
  type        = number
}

variable "docker_compose_version" {
  description = "Pinned Docker Compose plugin version installed during bootstrap."
  type        = string
}

variable "backend_secret_arn" {
  description = "Existing backend secret ARN. Only the ARN, never secret contents, enters user data."
  type        = string
}

variable "enable_detailed_monitoring" {
  description = "Whether EC2 detailed monitoring is enabled."
  type        = bool
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
