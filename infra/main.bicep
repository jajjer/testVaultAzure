targetScope = 'resourceGroup'

@description('Prefix for resource names (must be globally unique for storage account).')
param baseName string

@description('Azure region for resources.')
param location string = resourceGroup().location

@secure()
@description('SQL Server administrator password.')
param sqlAdminPassword string

param sqlAdminLogin string = 'testvaultadmin'

@description('Entra tenant ID for JWT validation.')
param azureAdTenantId string

@description('API audience (Application ID URI of the API registration).')
param azureAdAudience string

var sqlServerName = '${baseName}-sql'
var storageName = toLower(replace('${baseName}st', '-', ''))
var appServiceName = '${baseName}-api'
var appPlanName = '${baseName}-plan'
var insightsName = '${baseName}-insights'

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: 'testvault'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-04-01' = {
  name: storageName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-04-01' = {
  parent: storage
  name: 'default'
}

resource blobContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-04-01' = {
  parent: blobService
  name: 'testvault'
  properties: {
    publicAccess: 'None'
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: insightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appPlanName
  location: location
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true
  }
}

var sqlConn = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=testvault;User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=true'

resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: true
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'AZURE_SQL_CONNECTION_STRING'
          value: sqlConn
        }
        {
          name: 'AZURE_AD_TENANT_ID'
          value: azureAdTenantId
        }
        {
          name: 'AZURE_AD_AUDIENCE'
          value: azureAdAudience
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: insights.properties.ConnectionString
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
      ]
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output storageAccountName string = storage.name
output apiAppName string = apiApp.name
output apiAppHostName string = apiApp.properties.defaultHostName
output applicationInsightsConnectionString string = insights.properties.ConnectionString
