@echo off
rem What Task Scheduler runs every hour. One line per run goes to the log,
rem so a failing backup is written down rather than silent.
node "%~dp0backup.js" >> "%USERPROFILE%\spirit-backup.log" 2>&1
