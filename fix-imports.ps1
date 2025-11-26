# Fix all import paths after reorganization

$ErrorActionPreference = "Continue"

# Function to update imports in a file
function Update-Imports {
    param(
        [string]$FilePath,
        [hashtable]$Replacements
    )
    
    try {
        $content = Get-Content $FilePath -Raw
        $modified = $false
        
        foreach ($key in $Replacements.Keys) {
            if ($content -match [regex]::Escape($key)) {
                $content = $content -replace [regex]::Escape($key), $Replacements[$key]
                $modified = $true
            }
        }
        
        if ($modified) {
            Set-Content -Path $FilePath -Value $content -NoNewline
            Write-Host "Updated: $FilePath"
        }
    }
    catch {
        Write-Host "Error updating $FilePath : $_"
    }
}

# Update components in dpp/ folder
$dppFiles = Get-ChildItem -Path "src\components\dpp" -Filter "*.tsx"
$dppReplacements = @{
    "from '../lib/enhancedDataStore'" = "from '../../lib/data/enhancedDataStore'"
    "from '../lib/localData'" = "from '../../lib/data/localData'"
    "from '../lib/enhancedAdapter'" = "from '../../lib/data/enhancedAdapter'"
    "from '../lib/roleContext'" = "from '../../lib/utils/roleContext'"
    "from '../lib/verificationLocal'" = "from '../../lib/utils/verificationLocal'"
    "from '../lib/didOperationsLocal'" = "from '../../lib/operations/didOperationsLocal'"
    "from '../lib/dppManagerLocal'" = "from '../../lib/operations/dppManagerLocal'"
    "from '../lib/lifecycleHelpers'" = "from '../../lib/operations/lifecycleHelpers'"
    "from '../lib/schemas/" = "from '../../lib/schemas/"
}

foreach ($file in $dppFiles) {
    Update-Imports -FilePath $file.FullName -Replacements $dppReplacements
}

# Update modals
$modalFiles = Get-ChildItem -Path "src\components\modals" -Filter "*.tsx"
foreach ($file in $modalFiles) {
    Update-Imports -FilePath $file.FullName -Replacements $dppReplacements
}

# Update visualizations
$vizFiles = Get-ChildItem -Path "src\components\visualizations" -Filter "*.tsx"
foreach ($file in $vizFiles) {
    Update-Imports -FilePath $file.FullName -Replacements $dppReplacements
}

# Update auth
$authFiles = Get-ChildItem -Path "src\components\auth" -Filter "*.tsx"
foreach ($file in $authFiles) {
    Update-Imports -FilePath $file.FullName -Replacements $dppReplacements
}

# Update remaining root components
$rootComponents = Get-ChildItem -Path "src\components" -Filter "*.tsx"
foreach ($file in $rootComponents) {
    Update-Imports -FilePath $file.FullName -Replacements $dppReplacements
}

# Update lib files
$libData = Get-ChildItem -Path "src\lib\data" -Filter "*.ts*"
$libOps = Get-ChildItem -Path "src\lib\operations" -Filter "*.ts*"
$libUtils = Get-ChildItem -Path "src\lib\utils" -Filter "*.ts*"

$libReplacements = @{
    "from './enhancedDataStore'" = "from '../data/enhancedDataStore'"
    "from './localData'" = "from '../data/localData'"
    "from './mockDataGeneratorLocal'" = "from '../data/mockDataGeneratorLocal'"
    "from './enhancedAdapter'" = "from '../data/enhancedAdapter'"
    "from './didOperationsLocal'" = "from '../operations/didOperationsLocal'"
    "from './dppManagerLocal'" = "from '../operations/dppManagerLocal'"
    "from './bulkOperations'" = "from '../operations/bulkOperations'"
    "from './lifecycleHelpers'" = "from '../operations/lifecycleHelpers'"
    "from './didResolverLocal'" = "from '../operations/didResolverLocal'"
    "from './verificationLocal'" = "from '../utils/verificationLocal'"
    "from './watcherLocal'" = "from '../utils/watcherLocal'"
    "from './roleContext'" = "from '../utils/roleContext'"
}

foreach ($file in $libData + $libOps + $libUtils) {
    Update-Imports -FilePath $file.FullName -Replacements $libReplacements
}

Write-Host "Import fixes completed!"
