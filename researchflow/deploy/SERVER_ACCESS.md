# Acceso al servidor de produccion

Comando SSH verificado en el historial local:

```bash
ssh -i ~/.ssh/digital-ocean root@165.227.203.200
```

Puerto alternativo verificado para redes que bloquean el `22`:

```bash
ssh -p 2222 -i ~/.ssh/digital-ocean root@165.227.203.200
```

La clave privada permanece en `~/.ssh/digital-ocean` y no debe copiarse al repositorio.

SSH escucha en los puertos `22` y `2222`. No se debe agregar el puerto `443` a
`sshd_config`: ese puerto esta reservado por Docker/Caddy para HTTPS en todos
los dominios de `camba.tech`, y dos servicios no pueden enlazar el mismo puerto
en la misma IP.

Ruta del despliegue en el servidor:

```text
/opt/researchflow/deploy
```

Comprobaciones habituales despues de conectarse:

```bash
cd /opt/researchflow/deploy
docker compose ps
docker compose logs --tail=100 n8n
```

El frontend del chat se sirve desde `/opt/researchflow/chat/dist`. Para recrear
solo ese servicio, sin reiniciar el resto del stack:

```bash
cd /opt/researchflow/deploy
docker compose up -d --force-recreate --no-deps simulador
curl -fsS http://127.0.0.1:8777/api/health
```
