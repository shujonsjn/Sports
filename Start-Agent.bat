@echo off
title Live Streaming - Auto-Update Agent
echo.
echo  ====================================
echo   Auto-Update Agent Starting...
echo  ====================================
echo.
echo  This agent fetches match data every 60 seconds.
echo  Keep this window open in background.
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0agent.ps1"
