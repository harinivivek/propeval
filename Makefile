# PropEval Makefile
# ==================

# Environment configs
LOCAL_COMPOSE = docker-compose.local.yml
LOCAL_ENV = .env.local
DEV_COMPOSE = docker-compose.dev.yml
DEV_ENV = .env.dev

# ---- Local ----

local-up:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) up --build -d

local-down:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) down

local-logs:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) logs -f --timestamps

local-logs-backend:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) logs -f --timestamps backend

local-logs-frontend:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) logs -f --timestamps frontend

local-restart:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) restart

# ---- Database ----

migrate:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec backend alembic upgrade head

migration:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec backend alembic revision --autogenerate -m "$(msg)"

migrate-down:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec backend alembic downgrade -1

seed:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec backend python -m scripts.seed

# ---- Testing ----

test-backend:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec backend pytest -v

test-frontend:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec frontend npm test

test: test-backend test-frontend

# ---- Shell Access ----

shell-backend:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec backend bash

shell-frontend:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec frontend sh

shell-db:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) exec postgres psql -U propeval -d propeval

# ---- Dev Environment ----

dev-up:
	docker compose -f $(DEV_COMPOSE) --env-file $(DEV_ENV) up --build -d

dev-down:
	docker compose -f $(DEV_COMPOSE) --env-file $(DEV_ENV) down

dev-logs:
	docker compose -f $(DEV_COMPOSE) --env-file $(DEV_ENV) logs -f

# ---- Utilities ----

lint:
	cd backend && poetry run ruff check app/
	cd frontend && npm run lint

format:
	cd backend && poetry run ruff format app/

clean:
	docker compose -f $(LOCAL_COMPOSE) --env-file $(LOCAL_ENV) down -v
	docker system prune -f

.PHONY: local-up local-down local-logs local-logs-backend local-logs-frontend local-restart migrate migration migrate-down seed test-backend test-frontend test shell-backend shell-frontend shell-db dev-up dev-down dev-logs lint format clean
