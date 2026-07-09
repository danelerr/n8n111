#!/bin/bash
# Se ejecuta solo en el primer arranque de Postgres: crea las 3 bases del stack.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE n8n;
    CREATE DATABASE evolution;
    CREATE DATABASE researchflow;
EOSQL
