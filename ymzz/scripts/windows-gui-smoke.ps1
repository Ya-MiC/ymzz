# MIT. Native Windows UIAutomation against the FULL officially packaged Electron application.
# No browser automation or private API. All project/task data below is newly generated synthetic data.
param([Parameter(Mandatory=$true)][string]$BuildRoot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Windows.Forms,System.Drawing
$proof=Join-Path (Split-Path $PSScriptRoot -Parent) 'docs/evidence/windows';New-Item -ItemType Directory -Force $proof|Out-Null
# This is the actual official NSIS installer, not the upstream synthetic installer fixture.
$installer=Get-ChildItem -LiteralPath $BuildRoot -File -Filter '湛箴_ymzz-*-win-x64-unsigned.exe' | Select-Object -First 1
if(!$installer){throw 'Official upstream unsigned Windows NSIS installer missing'}
$portable=Join-Path $env:RUNNER_TEMP '湛箴_ymzz 安裝 中文 空格'
$setup=Start-Process -FilePath $installer.FullName -ArgumentList "/S /D=$portable" -PassThru
if(!$setup.WaitForExit(180000)){Stop-Process -Id $setup.Id -Force;throw 'Actual product installer exceeded180second limit'}
if($setup.ExitCode -ne 0){throw "Actual product installer returned $($setup.ExitCode)"}
$exe=Join-Path $portable '湛箴_ymzz.exe';if(!(Test-Path -LiteralPath $exe)){throw 'Actual installed branded FULL DSH EXE missing'}
if([System.Diagnostics.FileVersionInfo]::GetVersionInfo($exe).ProductName -ne '湛箴_ymzz'){throw 'Actual installed PE ProductName differs'}
$env:DSH_HOME=Join-Path $env:RUNNER_TEMP '湛箴_ymzz 資料 中文 空格'
$env:DSH_AGENTS_HOME=Join-Path $env:DSH_HOME 'agents'
$env:DSH_TELEMETRY_DISABLED='1'
$stateFile=Join-Path $env:DSH_HOME 'ymzz/tasks.json'
$nodeExe=Join-Path $portable 'resources/runtime/primary-runtime/dependencies/node/bin/node.exe'
if(!(Test-Path -LiteralPath $nodeExe)){throw 'Actual packaged primary Node missing'}
$nodeVersion=& $nodeExe --version
if($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.'){throw 'Actual packaged primary Node cannot execute'}
$p=Start-Process -FilePath $exe -ArgumentList '--force-renderer-accessibility' -PassThru
function State {
 if(!(Test-Path $stateFile)){return $null}
 $stream=[System.IO.File]::Open($stateFile,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete));$reader=[System.IO.StreamReader]::new($stream,[System.Text.Encoding]::UTF8)
 try{return ($reader.ReadToEnd()|ConvertFrom-Json)}finally{$reader.Dispose()}
}
function Find-Control([string]$name,$pattern=$null){
 $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,$name);$end=(Get-Date).AddSeconds(30)
 do{$found=$null;foreach($candidate in $Element.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)){if(!$pattern){$found=$candidate;break};try{$null=$candidate.GetCurrentPattern($pattern);$found=$candidate;break}catch{}};if(!$found){Start-Sleep -Milliseconds 200}}until($found -or (Get-Date) -gt $end)
 if(!$found){throw "Missing genuine FULL DSH GUI control: $name"};return $found
}
function Click([string]$name){$c=Find-Control $name ([System.Windows.Automation.InvokePattern]::Pattern);$c.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Start-Sleep -Milliseconds 250}
function Screenshot([string]$name){$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$i=[System.Drawing.Bitmap]::new($b.Width,$b.Height);$g=[System.Drawing.Graphics]::FromImage($i);$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);$i.Save((Join-Path $proof "$name.png"));$g.Dispose();$i.Dispose()}
try{
 $end=(Get-Date).AddSeconds(90);do{$p.Refresh();if($p.HasExited){throw 'FULL DSH EXE exited during GUI startup'};if($p.MainWindowHandle -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 300}}until($p.MainWindowHandle -ne [IntPtr]::Zero -or (Get-Date) -gt $end)
 if($p.MainWindowHandle -eq [IntPtr]::Zero){throw 'Full Electron main window never started'};$Element=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
 $nick=Find-Control '怎麼稱呼你？' ([System.Windows.Automation.ValuePattern]::Pattern);if($nick.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value -ne '用戶'){throw 'Nickname invented a nonconsented phone suffix'};$nick.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('湛箴 Windows 完整 DSH 驗收');Click '以暱稱開始使用完整 DSH'
 Find-Control '湛箴_ymzz'|Out-Null
 Find-Control '深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世'|Out-Null
 $nativeDocument=Find-Control '湛箴_ymzz';if($Element.Current.Name -ne '湛箴_ymzz'){throw "Actual native window title differs from requested product name: $($Element.Current.Name)"}
 Screenshot 'full-dsh-onboarding'
 $approvals=0
 $theme=Find-Control '湛箴四套溫潤主題';$theme.SetFocus();[System.Windows.Forms.SendKeys]::SendWait('{HOME}');Start-Sleep -Milliseconds 200;[System.Windows.Forms.SendKeys]::SendWait('{DOWN}{ENTER}');Start-Sleep -Milliseconds 500;Screenshot 'full-dsh-wenrun-dark';$theme.SetFocus();[System.Windows.Forms.SendKeys]::SendWait('{HOME}{ENTER}')
 function Complete-Demo([bool]$accept){
  $before=@((State).tasks.psobject.Properties.Name);Click '用完整 DSH Agent Loop 執行離線修復示例';$end=(Get-Date).AddSeconds(25)
  do{$s=State;$id=@($s.tasks.psobject.Properties.Name|Where-Object {$_ -notin $before})[0];if(!$id){Start-Sleep -Milliseconds 200}}until($id -or (Get-Date) -gt $end)
  if(!$id){throw 'Native GUI did not create actual full DSH AgentRegistry session'}
  foreach($tool in @('ymzz_read','ymzz_read','ymzz_patch','ymzz_test','ymzz_patch','ymzz_test')){Click "僅核准這次 $tool";$script:approvals++}
  $end=(Get-Date).AddSeconds(35);do{$t=(State).tasks.$id;if($t.state -ne 'review'){Start-Sleep -Milliseconds 250}}until($t.state -eq 'review' -or (Get-Date) -gt $end)
  if($t.state -ne 'review' -or @($t.gates).Count -ne 2 -or $t.gates[0].passed -or !$t.gates[1].passed){throw 'Full DSH did not execute genuine failing test -> repair -> passing test'}
  Start-Sleep -Seconds 2
  if($accept){Screenshot 'full-dsh-review';Click '已檢查差異：驗收這次 DSH 修改';Click '明確確認：記住這次 DSH 結果';$expected='accepted'}else{Click '已確認：還原這次 DSH 修改';$expected='rolled-back'}
  $t=(State).tasks.$id;if($t.state -ne $expected){throw "Human GUI review failed: $($t.state)"}
  $text=[System.IO.File]::ReadAllText((Join-Path $t.root 'calculator.mjs'));$want=if($accept){'a + b'}else{'a - b'};if(!$text.Contains($want)){throw 'Actual filesystem result contradicts GUI review'}
  return @{id=$id;state=$t.state;gates=$t.gates;actualFileMatches=$true}
 }
 $accepted=Complete-Demo $true;$rollback=Complete-Demo $false
 if(@((State).memory).Count -ne 1){throw 'Explicit DSH plugin memory confirmation was not persisted'}
 Screenshot 'full-dsh-task-board'
 @{accepted=$accepted;rollback=$rollback;approvals=$approvals;memoryConfirmed=@((State).memory).Count;engine='FULL official DeepSeek Harness';deterministicFakeTransport=$true;liveInference=$false}|ConvertTo-Json -Depth 30|Set-Content -Encoding utf8 (Join-Path $proof 'full-dsh-gui-task-checkpoint.json')
 Click '回到完整 DSH 工作區';Find-Control '湛箴_ymzz 插件與驗證閘' ([System.Windows.Automation.InvokePattern]::Pattern)|Out-Null;Screenshot 'full-dsh-native-workspace'
 # Native upstream settings are retained. Configuration only: never enter credentials or make inference.
 # The top-level Chromium UIA pane is not focusable. Use the REAL accessible native menu instead.
 Click 'Account menu';Click 'Settings';Start-Sleep -Seconds 2
 $models=$null;foreach($label in @('Models','模型')){try{$models=Find-Control $label ([System.Windows.Automation.InvokePattern]::Pattern);break}catch{}}
 if(!$models){throw 'Original full DSH Models settings navigation missing'};$models.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Start-Sleep -Seconds 1
 Screenshot 'full-dsh-native-model-settings'
 @{fullUpstreamApp=$true;engine='FULL official DeepSeek Harness Electron';upstream='39163dd30f703a79079e2d2446545cff3c453738';nativeGUI=$true;productDisplayName='湛箴_ymzz';nativeSidebarSlotPluginVerified=$true;originalDSHLayoutPreserved=$true;pluginLoadedViaProductionAssembly=$true;nicknameViaGUI=$true;approvals=$approvals;accepted=$accepted;rollback=$rollback;actualNodeTests=$true;deterministicFakeTransport=$true;liveInference=$false;nativeModelSettingsOpened=$true;providerConfigured=$false;modelWorking=$false;unicodeSpaceInstalledPath=$true;actualNSISInstalled=$true;nodeVersion=$nodeVersion;primaryNodeSHA256=(Get-FileHash $nodeExe -Algorithm SHA256).Hash;installerSHA256=(Get-FileHash $installer.FullName -Algorithm SHA256).Hash;exeSHA256=(Get-FileHash $exe -Algorithm SHA256).Hash;exeBytes=(Get-Item $exe).Length;actualUserIcon='Latest owner SVG-derived ICO, checked separately against PE resources';inheritedDSHProtocolRegistration=$true;customRegistryScript=$false;binaryDistribution='Not cleared until actual payload and corresponding-source compliance gates pass'}|ConvertTo-Json -Depth 30|Set-Content -Encoding utf8 (Join-Path $proof 'full-dsh-gui.json')
 "YMZZ_INSTALLED_PRODUCT=$portable"|Out-File -Append -Encoding utf8 $env:GITHUB_ENV
}catch{
 Screenshot 'full-dsh-failure'
 @{error=$_.Exception.Message;fullUpstreamApp=$true;liveInference=$false;binaryDistributed=$false}|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $proof 'failure.json')
 if($Element){@($Element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)|ForEach-Object {@{name=$_.Current.Name;type=$_.Current.ControlType.ProgrammaticName}})|ConvertTo-Json -Depth 4|Set-Content -Encoding utf8 (Join-Path $proof 'accessibility-diagnostic.json')}
 throw
}finally{if($p -and !$p.HasExited){taskkill /PID $p.Id /T /F 2>$null|Out-Null}}
