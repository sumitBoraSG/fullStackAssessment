build:
	@docker-compose -f docker-compose.yml build
dev:
	@docker-compose -f docker-compose.yml up -d
logs:
	@docker-compose -f docker-compose.yml logs -f
restart:
	rm -rf dist/*
	@docker-compose -f docker-compose.yml down
	@docker-compose -f docker-compose.yml build
	@docker-compose -f docker-compose.yml up
down:
	@docker-compose -f docker-compose.yml down
development:
	@docker-compose -f docker-compose.yml up