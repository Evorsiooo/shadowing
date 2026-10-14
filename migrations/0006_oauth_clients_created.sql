-- /oauth/register counts the clients created in the last hour (a site-wide cap), so index by time.
CREATE INDEX IF NOT EXISTS oauth_clients_created ON oauth_clients (created);
