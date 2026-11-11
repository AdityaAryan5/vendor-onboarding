CREATE TABLE request_limits(key text NOT NULL, window_start bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(key,window_start));
CREATE INDEX request_limits_window ON request_limits(window_start);
