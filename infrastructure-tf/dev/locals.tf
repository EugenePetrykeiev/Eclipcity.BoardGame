locals {
  name_prefix        = "${var.project}-${var.environment}"
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)

  common_tags = merge(
    {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = var.owner
      CostCenter  = var.cost_center
      Repository  = var.repository
    },
    var.extra_tags
  )
}
