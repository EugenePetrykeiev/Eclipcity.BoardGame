variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "vpc_id" {
  description = "VPC that owns the security groups."
  type        = string
}

variable "vpc_cidr" {
  description = "Production VPC CIDR advertised to the database VPC."
  type        = string
}

variable "backend_route_table_id" {
  description = "Production route table used by the backend subnet and receiving the database VPC route."
  type        = string
}

variable "backend_port" {
  description = "Private backend listener port."
  type        = number
}

variable "database_vpc_id" {
  description = "Existing VPC containing PostgreSQL."
  type        = string
}

variable "database_vpc_cidr" {
  description = "CIDR of the existing PostgreSQL VPC."
  type        = string
}

variable "database_route_table_id" {
  description = "Route table associated with the existing PostgreSQL subnet."
  type        = string
}

variable "database_security_group_id" {
  description = "Existing PostgreSQL security group."
  type        = string
}

variable "database_port" {
  description = "PostgreSQL listener port."
  type        = number
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
