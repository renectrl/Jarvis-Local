$ErrorActionPreference = "Stop"

try {
  Add-Type -AssemblyName System.Speech
  $Culture = [System.Globalization.CultureInfo]::GetCultureInfo("de-DE")
  $Recognizer = New-Object System.Speech.Recognition.SpeechRecognitionEngine($Culture)

  $Commands = New-Object System.Speech.Recognition.Choices
  @(
    "hey garmin starte steam", "garmin starte steam", "hey garmin öffne steam", "garmin öffne steam",
    "hey garmin starte discord", "garmin starte discord", "hey garmin öffne discord", "garmin öffne discord",
    "hey garmin starte spotify", "garmin starte spotify", "hey garmin öffne spotify", "garmin öffne spotify",
    "hey garmin starte browser", "garmin starte browser", "hey garmin öffne browser", "garmin öffne browser",
    "hey garmin starte opera", "garmin starte opera", "hey garmin öffne opera", "garmin öffne opera",
    "hey garmin starte league", "garmin starte league", "hey garmin starte league of legends", "garmin starte league of legends",
    "hey garmin starte aion", "garmin starte aion", "hey garmin starte aion zwei", "garmin starte aion zwei",
    "hey garmin starte visual studio code", "garmin starte visual studio code", "hey garmin starte code", "garmin starte code",
    "hey garmin starte chat gpt", "garmin starte chat gpt", "hey garmin starte codex", "garmin starte codex"
  ) | ForEach-Object { [void]$Commands.Add($_) }

  $Builder = New-Object System.Speech.Recognition.GrammarBuilder
  $Builder.Culture = $Culture
  $Builder.Append($Commands)
  $Grammar = New-Object System.Speech.Recognition.Grammar($Builder)
  $Recognizer.LoadGrammar($Grammar)
  $Recognizer.SetInputToDefaultAudioDevice()

  Register-ObjectEvent -InputObject $Recognizer -EventName SpeechRecognized -Action {
    $Result = $EventArgs.Result
    if ($Result.Confidence -ge 0.28) {
      $Payload = @{ type = "recognized"; text = $Result.Text; confidence = [Math]::Round($Result.Confidence, 2) } | ConvertTo-Json -Compress
      [Console]::Out.WriteLine($Payload)
      [Console]::Out.Flush()
    }
  } | Out-Null

  [Console]::Out.WriteLine((@{ type = "ready" } | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  $Recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)

  while ($true) { Start-Sleep -Milliseconds 250 }
}
catch {
  [Console]::Out.WriteLine((@{ type = "error"; message = $_.Exception.Message } | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  exit 1
}
