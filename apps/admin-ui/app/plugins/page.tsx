import { PluginList } from '@/components/plugin-list'
import { Button } from '@autoweave/ui'
import { Plus } from 'lucide-react'

export default function PluginsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Plugins</h2>
          <p className="text-muted-foreground">
            Manage your AutoWeave plugins and extensions
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Install Plugin
          </Button>
        </div>
      </div>

      <PluginList />
    </div>
  )
}