' Inicia o monitor de voos escondido (sem janela). Um atalho para este arquivo
' fica na pasta Inicializar do Windows, então ele sobe sozinho a cada login.
Set sh = CreateObject("WScript.Shell")
pasta = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = pasta
sh.Run "node """ & pasta & "\monitorar.js""", 0, False
