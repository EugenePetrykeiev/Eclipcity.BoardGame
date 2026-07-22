variable "name_prefix" {
  description = "Prefix used for resource names."
  type        = string
}

variable "backend_secret_arn" {
  description = "Existing Secrets Manager secret ARN granted to the backend."
  type        = string
}

variable "backend_secret_kms_key_arn" {
  description = "Optional customer-managed KMS key protecting the backend secret."
  type        = string
  nullable    = true
}

variable "tags" {
  description = "Common AWS tags."
  type        = map(string)
}
