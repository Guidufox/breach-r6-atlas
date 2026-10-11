Option Explicit
Dim shell, fso, folder, shortcut
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
Set shortcut = shell.CreateShortcut(shell.SpecialFolders("Desktop") & "\Breach - R6 Atlas.lnk")
shortcut.TargetPath = folder & "\Abrir-Breach.bat"
shortcut.WorkingDirectory = folder
shortcut.WindowStyle = 7
shortcut.IconLocation = folder & "\icon.ico"
shortcut.Description = "Mapas y callouts de Rainbow Six Siege sin Internet"
shortcut.Save
MsgBox "Acceso directo creado en el escritorio. Conserva esta carpeta en su ubicacion.", 64, "Breach - R6 Atlas"
