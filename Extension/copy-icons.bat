@echo off
echo Copying icons from public/icons to Extension/icons...

xcopy "..\public\icons\icon-72x72.png" "icons\" /Y
xcopy "..\public\icons\icon-96x96.png" "icons\" /Y
xcopy "..\public\icons\icon-128x128.png" "icons\" /Y
xcopy "..\public\icons\icon-144x144.png" "icons\" /Y
xcopy "..\public\icons\icon-152x152.png" "icons\" /Y
xcopy "..\public\icons\icon-192x192.png" "icons\" /Y
xcopy "..\public\icons\icon-384x384.png" "icons\" /Y
xcopy "..\public\icons\icon-512x512.png" "icons\" /Y

echo.
echo ✓ Icons copied successfully!
echo.
echo Next steps:
echo 1. Test extension locally (chrome://extensions)
echo 2. Create ZIP file for store submission
echo 3. Submit to Chrome/Firefox/Edge stores
echo.
echo See STORE_SUBMISSION.md for detailed instructions.
pause
