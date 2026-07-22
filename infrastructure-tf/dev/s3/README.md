# S3 in the dev environment

No application S3 bucket is currently required: frontend assets are delivered by
the frontend container, images will be pulled from ECR, and the database remains
external. Creating an unused bucket would add policy and lifecycle surface without
serving the application.

The Terraform state bucket is account-level infrastructure and is intentionally
bootstrapped from `infrastructure-tf/bootstrap`, outside this environment state.
