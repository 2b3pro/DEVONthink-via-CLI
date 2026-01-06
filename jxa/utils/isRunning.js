#!/usr/bin/env osascript -l JavaScript
// Check if DEVONthink is running
// Usage: osascript -l JavaScript isRunning.js

function run() {
  const app = Application("System Events");
  const processes = app.processes.whose({ name: { _beginsWith: "DEVONthink" } });

  const isRunning = processes.length > 0;
  const appName = "DEVONthink";
  const appShortName = "DT";

  return JSON.stringify({
    success: true,
    running: isRunning,
    appName,
    appShortName,
    message: isRunning
      ? "DEVONthink (DT) is running"
      : "DEVONthink (DT) is not running"
  });
}

run();
