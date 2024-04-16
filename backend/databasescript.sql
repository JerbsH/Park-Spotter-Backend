DROP DATABASE IF EXISTS parking;
CREATE DATABASE parking;
USE parking;

CREATE TABLE AVAILABLE_SPOTS (
        ID INT PRIMARY KEY AUTO_INCREMENT,
        PARKSPOTS INT,
        HANDICAPSPOTS INT
);
INSERT INTO AVAILABLE_SPOTS (PARKSPOTS, HANDICAPSPOTS) VALUES (0, 0);

CREATE TABLE DEVICE_TOKEN (
    ID INT PRIMARY KEY AUTO_INCREMENT,
    TOKEN VARCHAR(255) NOT NULL
);
INSERT INTO DEVICE_TOKEN (TOKEN) VALUES ('');
