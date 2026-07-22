variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "vpc_cidr" {
  description = "VPC IPv4 CIDR."
  type        = string
}

variable "availability_zones" {
  description = "Ordered availability zones used by subnets."
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "Ordered public subnet CIDRs."
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "Ordered private application subnet CIDRs."
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Whether private subnets receive Internet egress through a paid NAT Gateway."
  type        = bool
}

variable "enable_flow_logs" {
  description = "Whether to create VPC flow logs."
  type        = bool
}

variable "flow_log_retention_days" {
  description = "CloudWatch retention for flow logs."
  type        = number
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
