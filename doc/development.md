# Known Problems

## Running tests on Windows fails with error `Uncaught TypeError: Cannot read property 'phase' of null`

This is most likely related to run extension tests after installing extension from .vsix file.
On Windows the fix is to clean up `%USER_PROFILE%\AppData\Roaming\Code\CachedData` folder.
