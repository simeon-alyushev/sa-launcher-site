; SA Launcher: extra installer page "Create a desktop shortcut?"
; (directory choice and licence pages are the standard electron-builder pages)
; NOTE: everything that only the installer needs is guarded with BUILD_UNINSTALLER,
; otherwise the uninstaller pass reports "unreferenced function/variable" warnings,
; and electron-builder treats NSIS warnings as errors.
!ifndef BUILD_UNINSTALLER

!macro customHeader
  !include "nsDialogs.nsh"
  !include "LogicLib.nsh"
  Var /GLOBAL SA_ScCheck
  Var /GLOBAL SA_ScState
  Var /GLOBAL SA_Dlg
!macroend

!macro customInit
  StrCpy $SA_ScState 1
!macroend

; The page functions are defined here (not in customHeader) because the MUI2 macros
; (MUI_HEADER_TEXT) are only available once the assisted-installer pages are being declared.
!macro customPageAfterChangeDir
  Function SA_ShortcutPage
    ${If} ${Silent}
      Abort
    ${EndIf}
    ${Switch} $LANGUAGE
      ${Case} 1049
        StrCpy $1 "Дополнительные задачи"
        StrCpy $2 "Создать ярлык на рабочем столе"
        ${Break}
      ${Case} 1045
        StrCpy $1 "Dodatkowe zadania"
        StrCpy $2 "Utwórz skrót na pulpicie"
        ${Break}
      ${Case} 1058
        StrCpy $1 "Додаткові завдання"
        StrCpy $2 "Створити ярлик на робочому столі"
        ${Break}
      ${Default}
        StrCpy $1 "Additional tasks"
        StrCpy $2 "Create a desktop shortcut"
    ${EndSwitch}
    !insertmacro MUI_HEADER_TEXT "SA Launcher" "$1"
    nsDialogs::Create 1018
    Pop $SA_Dlg
    ${If} $SA_Dlg == error
      Abort
    ${EndIf}
    ${NSD_CreateCheckbox} 0 10u 100% 12u "$2"
    Pop $SA_ScCheck
    ${NSD_SetState} $SA_ScCheck $SA_ScState
    nsDialogs::Show
  FunctionEnd
  Function SA_ShortcutPageLeave
    ${NSD_GetState} $SA_ScCheck $SA_ScState
  FunctionEnd
  Page custom SA_ShortcutPage SA_ShortcutPageLeave
!macroend

!macro customInstall
  ${If} $SA_ScState == 1
    CreateShortCut "$DESKTOP\${SHORTCUT_NAME}.lnk" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0
  ${EndIf}
!macroend

!endif

!macro customUnInstall
  ${ifNot} ${isUpdated}
    Delete "$DESKTOP\${SHORTCUT_NAME}.lnk"
  ${endIf}
!macroend
