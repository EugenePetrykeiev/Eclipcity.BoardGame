variable "enabled" {
  description = "Whether to create the SES identity."
  type        = bool
}

variable "aws_region" {
  description = "AWS region used to form the SES feedback endpoint."
  type        = string
}

variable "domain_name" {
  description = "SES identity domain."
  type        = string
}
