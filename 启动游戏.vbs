' ============================================
' 《妈妈的无影脚》一键启动器
' 双击:后台拉起本地服务器(隐藏窗口)并打开游戏网页
' 没装 Node 时自动降级为直接打开 index.html(功能相同)
' ============================================
Option Explicit
Dim sh, fso, dir, hasNode
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' 检查 node(隐藏窗口,同步等待结果)
hasNode = (sh.Run("cmd /c where node >nul 2>nul", 0, True) = 0)

If hasNode Then
    ' 启动静态服务器;若 8830 端口已有服务器在跑,新实例会自动退出,无副作用
    sh.Run "cmd /c cd /d """ & dir & """ && npx --yes http-server -p 8830 -c-1 >nul 2>nul", 0, False
    WScript.Sleep 1800
    sh.Run "http://localhost:8830", 1, False
Else
    ' 无 Node:直接用浏览器打开(音频已内嵌,file:// 也能完整游玩)
    sh.Run """" & dir & "\index.html""", 1, False
End If
