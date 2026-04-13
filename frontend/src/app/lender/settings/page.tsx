"use client";
import UsersTab from "./_components/users-tab";
import TemplateBuilder from "./_components/template-builder";
import { NotificationPrefs } from "./_components/notification-prefs";
import { LenderConfigTab } from "./_components/lender-config-tab";
import { PageHeader } from "@/components/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function LenderSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your organisation settings" />

      <Tabs defaultValue="users">
        <TabsList variant="line">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="template">Report Template</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="template"><TemplateBuilder /></TabsContent>
        <TabsContent value="notifications"><NotificationPrefs /></TabsContent>
        <TabsContent value="config"><LenderConfigTab /></TabsContent>
      </Tabs>
    </div>
  );
}
