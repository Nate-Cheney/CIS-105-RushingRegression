
SELECT play_id, ydstogo, yards_gained
FROM plays;

SELECT ydstogo, AVG(yards_gained) as avg_yards
FROM plays
WHERE rush_attempt = 1.0
GROUP BY ydstogo;

-- slope 0.12588674 --`
-- intercept 3.47336519 --
-- yds_to_go * slope + intercept --
SELECT rusher_player_id, rusher_player_name, yards_gained, 
    (ydstogo * 0.12588674 + 3.47336519) as expected_yards
FROM plays
WHERE rush_attempt = 1.0;


-- Used in web app --
SELECT rusher_player_id, rusher_player_name, 
    (yards_gained - (ydstogo * 0.12588674 + 3.47336519)) as yards_oe
FROM plays
WHERE rush_attempt = 1.0;

SELECT rusher_player_id, rusher_player_name,COUNT(*) as rushes,
    AVG(yards_gained - (ydstogo * 0.12588674 + 3.47336519)) as ryoe
FROM plays
WHERE rush_attempt = 1.0 
GROUP BY rusher_player_id
HAVING rushes >= 100
ORDER BY ryoe DESC;


SELECT COUNT(*) as rushes,
    AVG(yards_gained - (ydstogo * 0.12588674 + 3.47336519)) as ryoe
FROM plays
WHERE rush_attempt = 1.0 AND rusher_player_name == "<USER INPUT>";

SELECT rusher_player_name, COUNT(*) as rushes,
    AVG(yards_gained - (ydstogo * 0.12588674 + 3.47336519)) as ryoe
FROM plays
WHERE rush_attempt = 1.0
GROUP BY rusher_player_name
HAVING rushes >= <USER INPUT>
ORDER BY ryoe DESC
LIMIT 10;

--------------------------

SELECT 
    rusher_player_id,
    rusher_player_name,
    yards_gained,
    ydstogo,
    down
FROM plays
WHERE rush_attempt = 1.0;

SELECT
    CASE WHEN down = 2.0 THEN 1 ELSE 0 END AS d2,
    CASE WHEN down = 3.0 THEN 1 ELSE 0 END AS d3,
    CASE WHEN down = 4.0 THEN 1 ELSE 0 END AS d4
FROM plays
WHERE rush_attempt = 1.0;



SELECT 
    rusher_player_id,
    rusher_player_name,
    yards_gained,
    ydstogo,
    CASE WHEN down = 2.0 THEN 1.0 ELSE 0.0 END AS is_2nd_down,
    CASE WHEN down = 3.0 THEN 1.0 ELSE 0.0 END AS is_3rd_down,
    CASE WHEN down = 4.0 THEN 1.0 ELSE 0.0 END AS is_4th_down
FROM plays
WHERE rush_attempt = 1.0;
