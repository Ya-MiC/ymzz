# MIT. Native Windows UIAutomation against the FULL officially packaged Electron application.
# No browser automation or private API. All project/task data below is newly generated synthetic data.
param([Parameter(Mandatory=$true)][string]$BuildRoot)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,System.Windows.Forms,System.Drawing
# Actual visible native GUI input in the CI test only; no DOM mutation or injected success.
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class YmzzTestMouse {
 [DllImport("user32.dll")] public static extern bool SetCursorPos(int x,int y);
 [DllImport("user32.dll")] public static extern void mouse_event(uint flags,uint dx,uint dy,uint data,UIntPtr extra);
}
'@
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
$pythonExe=Join-Path $portable 'resources/runtime/primary-runtime/dependencies/python/python.exe'
if(!(Test-Path -LiteralPath $pythonExe)){throw 'Actual bundled Python missing'}
$compiled=& $pythonExe -I -c "import json;from lxml import etree;print(json.dumps({'lxml':etree.LXML_VERSION,'iconvCompiled':etree.ICONV_COMPILED_VERSION,'libxmlCompiled':etree.LIBXML_COMPILED_VERSION,'libxsltCompiled':etree.LIBXSLT_COMPILED_VERSION}))"
if($LASTEXITCODE -ne 0){throw 'Actual bundled lxml cannot report its compiled dependency versions'}
$compiled|Set-Content -Encoding utf8 (Join-Path $proof 'python-compiled-libraries.json')
& $pythonExe -I -B (Join-Path $PSScriptRoot 'verify-installed-xsl.py') --output (Join-Path $proof 'installed-mit-xsl.json')
if($LASTEXITCODE -ne 0){throw 'Actual installed MIT XSL resource/extraction qualification failed'}
$nodeVersion=& $nodeExe --version
if($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.'){throw 'Actual packaged primary Node cannot execute'}
node ymzz/scripts/check-pe-icon.mjs --exe $exe --ico ymzz/branding/generated/icon.ico --output (Join-Path $proof 'pe-icon.json')
if($LASTEXITCODE -ne 0){throw 'Actual PE resources do not contain exact owner icon frames'}
@{actualNSISInstalled=$true;unicodeSpaceInstallPath=$true;productName='湛箴_ymzz';installerSHA256=(Get-FileHash $installer.FullName -Algorithm SHA256).Hash;exeSHA256=(Get-FileHash $exe -Algorithm SHA256).Hash;nodeVersion=$nodeVersion;primaryNodeSHA256=(Get-FileHash $nodeExe -Algorithm SHA256).Hash;nativeGUIQualified=$false}|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $proof 'installed-prechecks.json')
$p=Start-Process -FilePath $exe -ArgumentList '--force-renderer-accessibility' -PassThru
function State {
 if(!(Test-Path $stateFile)){return $null}
 $stream=[System.IO.File]::Open($stateFile,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete));$reader=[System.IO.StreamReader]::new($stream,[System.Text.Encoding]::UTF8)
 try{return ($reader.ReadToEnd()|ConvertFrom-Json)}finally{$reader.Dispose()}
}
function Find-Control([string]$name,$pattern=$null){
 $condition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty,$name);$end=(Get-Date).AddSeconds(30)
 do{$found=$null;foreach($candidate in $Element.FindAll([System.Windows.Automation.TreeScope]::Descendants,$condition)){if(!$pattern){$found=$candidate;break};if(!$candidate.Current.IsEnabled){continue};try{$null=$candidate.GetCurrentPattern($pattern);$found=$candidate;break}catch{}};if(!$found){Start-Sleep -Milliseconds 200}}until($found -or (Get-Date) -gt $end)
 if(!$found){throw "Missing genuine FULL DSH GUI control: $name"};return $found
}
function Click([string]$name){$c=Find-Control $name ([System.Windows.Automation.InvokePattern]::Pattern);$c.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Start-Sleep -Milliseconds 250}
function Screenshot([string]$name){$b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds;$i=[System.Drawing.Bitmap]::new($b.Width,$b.Height);$g=[System.Drawing.Graphics]::FromImage($i);$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size);$i.Save((Join-Path $proof "$name.png"));$g.Dispose();$i.Dispose()}
try{
 $end=(Get-Date).AddSeconds(90);do{$p.Refresh();if($p.HasExited){throw 'FULL DSH EXE exited during GUI startup'};if($p.MainWindowHandle -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 300}}until($p.MainWindowHandle -ne [IntPtr]::Zero -or (Get-Date) -gt $end)
 if($p.MainWindowHandle -eq [IntPtr]::Zero){throw 'Full Electron main window never started'};$Element=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
 # Preserved native first-run flow: use its real Set up later button. No key/login/fake credential.
 Screenshot 'full-dsh-native-welcome'
 Click 'Add API Key';Click 'Set up later';Start-Sleep -Seconds 3
 $p.Refresh();$Element=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
 $nick=Find-Control '怎麼稱呼你？' ([System.Windows.Automation.ValuePattern]::Pattern);if($nick.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value -ne '用戶'){throw 'Nickname invented a nonconsented phone suffix'};$nick.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('湛箴 Windows 完整 DSH 驗收');Click '以暱稱開始使用完整 DSH'
 Find-Control '湛箴_ymzz'|Out-Null
 Find-Control '深淵的清澈的水，纂刻于竹篾上的痕，珍重微小，有所依據，立傳傳世'|Out-Null
 $nativeDocument=Find-Control '湛箴_ymzz';if($Element.Current.Name -ne '湛箴_ymzz'){throw "Actual native window title differs from requested product name: $($Element.Current.Name)"}
 Screenshot 'full-dsh-onboarding'
 $approvals=0;$script:themeProof=@()
 # Actual UIA option selection, not unverified foreground SendKeys (which left light selected).
 function Select-Theme([string]$label){
  $theme=Find-Control '湛箴四套溫潤主題';try{$theme.GetCurrentPattern([System.Windows.Automation.ScrollItemPattern]::Pattern).ScrollIntoView()}catch{}
  # Chromium exposes popup options without clickable points. Focus the REAL select, verify
  # UIA keyboard focus, then use native keyboard navigation/Enter; never set a DOM value.
  $theme.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Collapse()
  $theme.SetFocus();Start-Sleep -Milliseconds 200
  $focused=[System.Windows.Automation.AutomationElement]::FocusedElement
  if(![System.Windows.Automation.Automation]::Compare($theme,$focused)){throw 'Actual native theme select did not receive keyboard focus'}
  $labels=@('雲箋 · 淺','雲箋 · 暗（暮靄）','陶土 · 淺','陶土 · 暗（暮林）');$index=[array]::IndexOf($labels,$label)
  if($index -lt 0){throw 'Unknown pinned native theme option'}
  [System.Windows.Forms.SendKeys]::SendWait('{HOME}')
  for($i=0;$i -lt $index;$i++){[System.Windows.Forms.SendKeys]::SendWait('{DOWN}')}
  [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
  $tokens=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../packages/ymzz/product/wenrun-tokens.css') -Raw
  $expression=if($label -like '*暗*'){'\[data-theme="dark"\]\s*\{\s*--bg-0:\s*(#[0-9A-Fa-f]{6})'}else{'--c-cloud-paper:\s*(#[0-9A-Fa-f]{6})'}
  $match=[regex]::Match($tokens,$expression);if(!$match.Success){throw 'Immutable authority background token missing'};$expected=$match.Groups[1].Value.ToUpperInvariant();$end=(Get-Date).AddSeconds(10)
  do{
   $dialog=Find-Control '湛箴 DSH 任務與驗證閘';$rect=$dialog.Current.BoundingRectangle
   $pixel=[System.Drawing.Bitmap]::new(1,1);$graphics=[System.Drawing.Graphics]::FromImage($pixel)
   try{$graphics.CopyFromScreen(([int]$rect.Left+18),([int]$rect.Top+18),0,0,[System.Drawing.Size]::new(1,1));$color=$pixel.GetPixel(0,0);$actual='#{0:X2}{1:X2}{2:X2}' -f $color.R,$color.G,$color.B}finally{$graphics.Dispose();$pixel.Dispose()}
   if($actual -ne $expected){Start-Sleep -Milliseconds 200}
  }until($actual -eq $expected -or (Get-Date) -gt $end)
  if($actual -ne $expected){throw "Actual native-clicked theme differs from authority token: $label expected $expected got $actual"}
  $script:themeProof+=@{label=$label;actualColor=$actual;authorityColor=$expected;interaction='UIA verified actual select keyboard focus + native Home/Down/Enter; rendered authority color asserted'}
 }
 function Complete-Demo([bool]$accept){
  $before=@((State).tasks.psobject.Properties.Name);Click '用完整 DSH Agent Loop 執行離線修復示例';$end=(Get-Date).AddSeconds(25)
  do{$s=State;$id=@($s.tasks.psobject.Properties.Name|Where-Object {$_ -notin $before})[0];if(!$id){Start-Sleep -Milliseconds 200}}until($id -or (Get-Date) -gt $end)
  if(!$id){throw 'Native GUI did not create actual full DSH AgentRegistry session'}
  $decisions=0
  foreach($tool in @('ymzz_read','ymzz_read','ymzz_patch','ymzz_test','ymzz_patch','ymzz_test')){
   Click "僅核准這次 $tool";$decisions++;$end=(Get-Date).AddSeconds(10)
   do{$recorded=@((State).events|Where-Object {$_.id -eq $id -and $_.kind -eq 'human-tool-approval'}).Count;if($recorded -lt $decisions){Start-Sleep -Milliseconds 100}}until($recorded -ge $decisions -or (Get-Date) -gt $end)
   if($recorded -ne $decisions){throw 'Native approval was not recorded exactly once for this task'};$script:approvals++
  }
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
 Select-Theme '雲箋 · 暗（暮靄）';Screenshot 'full-dsh-wenrun-dark';Select-Theme '雲箋 · 淺'
 Click '回到完整 DSH 工作區';Find-Control '湛箴_ymzz 插件與驗證閘' ([System.Windows.Automation.InvokePattern]::Pattern)|Out-Null;Screenshot 'full-dsh-native-workspace'
 # Native upstream settings are retained. Configuration only: never enter credentials or make inference.
 # The top-level Chromium UIA pane is not focusable. Use the REAL accessible native menu instead.
 Click 'Account menu';Click 'Settings';Start-Sleep -Seconds 2
 $models=$null;foreach($label in @('Models','模型')){try{$models=Find-Control $label ([System.Windows.Automation.InvokePattern]::Pattern);break}catch{}}
 if(!$models){throw 'Original full DSH Models settings navigation missing'};$models.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Start-Sleep -Seconds 1
 Screenshot 'full-dsh-native-model-settings'
 # Read-only official built-in plugin inventory, not marketplace/install/update actions.
 $builtins=$null;foreach($label in @('Built-in plugins','内置插件')){try{$builtins=Find-Control $label ([System.Windows.Automation.InvokePattern]::Pattern);break}catch{}}
 if(!$builtins){throw 'Original built-in plugin inventory navigation missing'};$builtins.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
 $search=$null;foreach($label in @('Search plugins','搜索插件')){try{$search=Find-Control $label ([System.Windows.Automation.ValuePattern]::Pattern);break}catch{}}
 if(!$search){throw 'Native built-in plugin inventory filter missing'};$search.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue('@ymzz/dsh-product')
 $end=(Get-Date).AddSeconds(30);$pluginRow=$null
 do{foreach($candidate in $Element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)){if($candidate.Current.Name -match '@ymzz/dsh-product|ymzz-product' -and $candidate.Current.ControlType -eq [System.Windows.Automation.ControlType]::Button){try{$null=$candidate.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern);$pluginRow=$candidate;break}catch{}}};if(!$pluginRow){Start-Sleep -Milliseconds 200}}until($pluginRow -or (Get-Date) -gt $end)
 if(!$pluginRow -or $pluginRow.Current.Name -match 'Failed|Disabled|失败|禁用'){throw 'Native inventory did not show the actual enabled ymzz plugin'}
 $nativePluginRow=$pluginRow.Current.Name;$pluginRow.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();Screenshot 'full-dsh-native-plugin-inventory'
 @{fullUpstreamApp=$true;engine='FULL official DeepSeek Harness Electron';upstream='39163dd30f703a79079e2d2446545cff3c453738';nativeGUI=$true;productDisplayName='湛箴_ymzz';nativeSidebarSlotPluginVerified=$true;originalDSHLayoutPreserved=$true;pluginLoadedViaProductionAssembly=$true;nicknameViaGUI=$true;approvals=$approvals;accepted=$accepted;rollback=$rollback;actualNodeTests=$true;deterministicFakeTransport=$true;liveInference=$false;nativeModelSettingsOpened=$true;nativeDarkThemeSelectionVerified=$true;nativeThemeProof=$script:themeProof;nativePluginInventoryRow=$nativePluginRow;providerConfigured=$false;modelWorking=$false;unicodeSpaceInstalledPath=$true;actualNSISInstalled=$true;nodeVersion=$nodeVersion;primaryNodeSHA256=(Get-FileHash $nodeExe -Algorithm SHA256).Hash;installerSHA256=(Get-FileHash $installer.FullName -Algorithm SHA256).Hash;exeSHA256=(Get-FileHash $exe -Algorithm SHA256).Hash;exeBytes=(Get-Item $exe).Length;actualUserIcon='Latest owner SVG-derived ICO, checked separately against PE resources';inheritedDSHProtocolRegistration=$true;customRegistryScript=$false;binaryDistribution='Not cleared until actual payload and corresponding-source compliance gates pass'}|ConvertTo-Json -Depth 30|Set-Content -Encoding utf8 (Join-Path $proof 'full-dsh-gui.json')
 "YMZZ_INSTALLED_PRODUCT=$portable"|Out-File -Append -Encoding utf8 $env:GITHUB_ENV
}catch{
 Screenshot 'full-dsh-failure'
 @{error=$_.Exception.Message;fullUpstreamApp=$true;liveInference=$false;binaryDistributed=$false}|ConvertTo-Json|Set-Content -Encoding utf8 (Join-Path $proof 'failure.json')
 if($Element){@($Element.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition)|ForEach-Object {@{name=$_.Current.Name;type=$_.Current.ControlType.ProgrammaticName;enabled=$_.Current.IsEnabled;automationId=$_.Current.AutomationId}})|ConvertTo-Json -Depth 4|Set-Content -Encoding utf8 (Join-Path $proof 'accessibility-diagnostic.json')}
 throw
}finally{if($p -and !$p.HasExited){taskkill /PID $p.Id /T /F 2>$null|Out-Null}}
