' dsh-pet silent launcher (Windows)
'
' Double-click: the pet appears, no console window is left behind.
'   - Requires Node.js >= 22.12 on PATH (the portable build in dist/portable ships its own node.exe)
'   - If the project is not built yet, a message box tells you what to run
'   - Single instance: launching twice will not start a second pet (quit from the tray instead)
'   - Log file: %USERPROFILE%\.dsh\dsh-pet\standalone.log
'
' Messages are intentionally ASCII: VBScript reads .vbs as ANSI unless saved as UTF-16.

Option Explicit
Dim fso, shell, base, libFile
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

base = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = base
libFile = base & "\lib\main.js"

If Not fso.FileExists(libFile) Then
  MsgBox "dsh-pet is not built yet." & vbCrLf & vbCrLf & _
         "Open a terminal in this folder and run:" & vbCrLf & _
         "    npm install" & vbCrLf & _
         "    npm run build", 48, "dsh-pet"
  WScript.Quit 1
End If

' 'where node' returns 0 only when Node is on PATH
If shell.Run("cmd /c where node >nul 2>nul", 0, True) <> 0 Then
  MsgBox "Node.js was not found on PATH." & vbCrLf & vbCrLf & _
         "Install Node.js 22.12+ or use the portable build in dist\portable (bundled runtime).", 48, "dsh-pet"
  WScript.Quit 1
End If

' window style 0 = hidden, wait = False so the script exits and the pet keeps running
shell.Run "node lib\main.js", 0, False
