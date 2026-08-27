# Codestra social monitoring

The application metrics endpoint is disabled by default. Enable it only on an authenticated or private path and set `METRICS_ALLOWED_IPS` to exact scraper addresses. Labels are bounded and contain no email, user, organization, destination URL, post content, token, or credential data.

Before production activation, import `codestra-social-alerts.yml`, configure an owner-approved non-human receiver, attach the referenced runbooks, and prove both firing and recovery delivery with synthetic events. The dashboard must display `codestra_build_info` alongside HTTP, container, PostgreSQL, Redis, Temporal, Elasticsearch, disk, inode, backup, queue, OAuth refresh, provider, webhook, media, and frontend-error panels.

