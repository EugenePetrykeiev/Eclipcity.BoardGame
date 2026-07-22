module "kms" {
  source = "./kms"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

module "vpc" {
  source = "./vpc"

  name_prefix             = local.name_prefix
  vpc_cidr                = var.vpc_cidr
  availability_zones      = local.availability_zones
  public_subnet_cidrs     = var.public_subnet_cidrs
  private_subnet_cidrs    = var.private_subnet_cidrs
  enable_flow_logs        = var.enable_vpc_flow_logs
  flow_log_retention_days = var.vpc_flow_log_retention_days
  tags                    = local.common_tags
}

module "network" {
  source = "./network"

  name_prefix                = local.name_prefix
  vpc_id                     = module.vpc.vpc_id
  vpc_cidr                   = var.vpc_cidr
  private_route_table_id     = module.vpc.private_route_table_id
  backend_port               = var.backend_port
  database_vpc_id            = data.aws_vpc.database.id
  database_vpc_cidr          = data.aws_vpc.database.cidr_block
  database_route_table_id    = var.database_route_table_id
  database_security_group_id = var.database_security_group_id
  database_port              = var.database_port
  tags                       = local.common_tags
}

module "iam" {
  source = "./iam"

  name_prefix                = local.name_prefix
  backend_secret_arn         = var.backend_secret_arn
  backend_secret_kms_key_arn = var.backend_secret_kms_key_arn
  tags                       = local.common_tags
}

module "ec2" {
  source = "./ec2"

  name_prefix                = local.name_prefix
  aws_region                 = var.aws_region
  domain_name                = var.domain_name
  ami_id                     = data.aws_ssm_parameter.al2023_arm64.value
  frontend_instance_type     = var.frontend_instance_type
  backend_instance_type      = var.backend_instance_type
  frontend_subnet_id         = module.vpc.public_subnet_ids[0]
  backend_subnet_id          = module.vpc.private_subnet_ids[0]
  frontend_security_group_id = module.network.frontend_security_group_id
  backend_security_group_id  = module.network.backend_security_group_id
  frontend_instance_profile  = module.iam.frontend_instance_profile_name
  backend_instance_profile   = module.iam.backend_instance_profile_name
  ebs_kms_key_arn            = module.kms.ebs_key_arn
  root_volume_size_gb        = var.root_volume_size_gb
  backend_secret_arn         = var.backend_secret_arn
  enable_detailed_monitoring = var.enable_detailed_monitoring
  tags                       = local.common_tags

  depends_on = [module.vpc, module.network, module.iam, module.kms]
}

module "ses" {
  source = "./ses"

  enabled     = var.enable_ses_identity
  aws_region  = var.aws_region
  domain_name = var.domain_name
}

module "dns" {
  source = "./dns"

  domain_name               = var.domain_name
  application_ipv4          = module.ec2.frontend_public_ip
  additional_records        = module.ses.dns_records
  private_vpc_id            = module.vpc.vpc_id
  private_database_hostname = var.private_database_hostname
  database_private_ipv4     = data.aws_instance.database.private_ip
  tags                      = local.common_tags
}
