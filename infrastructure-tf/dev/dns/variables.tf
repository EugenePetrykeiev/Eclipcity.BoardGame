variable "domain_name" {
  description = "Application FQDN."
  type        = string
}

variable "application_ipv4" {
  description = "Frontend Elastic IP used by the A record."
  type        = string
}

variable "application_ttl" {
  description = "Application A record TTL."
  type        = number
  default     = 300
}

variable "additional_records" {
  description = "Additional externally managed records, currently SES verification records."
  type = list(object({
    name  = string
    type  = string
    ttl   = number
    value = string
  }))
  default = []
}

variable "private_vpc_id" {
  description = "Dev VPC associated with the private database hosted zone."
  type        = string
}

variable "private_database_hostname" {
  description = "Stable private hostname for the existing PostgreSQL instance."
  type        = string
}

variable "database_private_ipv4" {
  description = "Existing PostgreSQL private IPv4 address."
  type        = string
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
