
SELECT play_id, ydstogo, yards_gained
FROM plays;

SELECT ydstogo, AVG(yards_gained) as avg_yards
FROM plays
WHERE rush_attempt = 1.0
GROUP BY ydstogo;
