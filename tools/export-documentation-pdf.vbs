Option Explicit

Const wdExportFormatPDF = 17
Const wdExportOptimizeForPrint = 0
Const wdExportAllDocument = 0
Const wdExportDocumentContent = 0
Const wdExportCreateHeadingBookmarks = 1

Dim fso, baseDir, inputPath, outputDir, outputPath, word, document
Set fso = CreateObject("Scripting.FileSystemObject")

baseDir = fso.GetAbsolutePathName(".")
inputPath = fso.BuildPath(baseDir, "output\documents\teste-documentacao-v2.docx")
outputDir = fso.BuildPath(baseDir, "output\pdf")
outputPath = fso.BuildPath(outputDir, "teste-documentacao-v2.pdf")

If Not fso.FileExists(inputPath) Then
  WScript.Echo "DOCX não encontrado: " & inputPath
  WScript.Quit 1
End If

If Not fso.FolderExists(outputDir) Then
  fso.CreateFolder(outputDir)
End If

On Error Resume Next
Set word = CreateObject("Word.Application")
If Err.Number <> 0 Then
  WScript.Echo "Não foi possível iniciar o Microsoft Word: " & Err.Description
  WScript.Quit 1
End If
On Error GoTo 0

word.Visible = False
word.DisplayAlerts = 0

On Error Resume Next
Set document = word.Documents.Open(inputPath, False, True)
If Err.Number <> 0 Then
  WScript.Echo "Não foi possível abrir o DOCX: " & Err.Description
  word.Quit
  WScript.Quit 1
End If

document.Repaginate
document.ExportAsFixedFormat outputPath, wdExportFormatPDF, False, wdExportOptimizeForPrint, wdExportAllDocument, 1, 1, wdExportDocumentContent, True, True, wdExportCreateHeadingBookmarks, True, True, False
If Err.Number <> 0 Then
  WScript.Echo "Falha ao exportar o PDF: " & Err.Description
  document.Close False
  word.Quit
  WScript.Quit 1
End If
On Error GoTo 0

document.Close False
word.Quit

WScript.Echo "PDF criado: " & outputPath
