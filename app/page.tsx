"use client";

import { getInvoices, type InvoiceWithUser } from "@/app/actions/invoice";
import { AddInvoice } from "@/components/add-invoice";
import { DeleteButton } from "@/components/delete-invoice-button";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle
} from "@/components/ui/item";
import { useAuth } from "@/contexts/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function Home() {
  const [invoices, setInvoices] = useState<InvoiceWithUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const hasTriggeredLogin = useRef(false);

  // 獲取發票列表
  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      const result = await getInvoices();
      if (result.error) {
        setError(result.error);
        setInvoices(null);
      } else {
        setError(null);
        setInvoices(result.data || []);
      }
      setLoading(false);
    }

    fetchInvoices();
  }, []);

  // 自動登入
  useEffect(() => {
    if (!authLoading && !user && !hasTriggeredLogin.current) {
      hasTriggeredLogin.current = true;
      supabase.auth.signInWithOAuth({
        provider: "keycloak",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          scopes: "openid",
        },
      });
    }
  }, [authLoading, user, supabase]);

  return (
    <div className="flex flex-col item-center justify-center max-w-5xl mx-auto p-4 gap-4">
      <div className="flex flex-row items-center justify-between w-full">
        <h2 className="text-xl font-bold mx-2">發票列表</h2>
        <AddInvoice />
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950 p-3 rounded">
          載入錯誤: {error}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">
            載入中...
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            尚無發票記錄，點擊「新增」開始上傳發票
          </div>
        ) : (
          invoices.map((invoice) => (
            <Item
              key={invoice.id}
              variant="outline"
              className="bg-background/70 backdrop-blur-lg hover:bg-background/50 hover:scale-[1.01] transition-all duration-200"
            >
              <ItemContent>
                <ItemTitle className="text-lg font-bold">{invoice.name}</ItemTitle>
                <div className="text-base text-muted-foreground">
                  <div className="flex flex-col gap-1">
                    <div>發票金額：NT$ {Number(invoice.amount).toLocaleString()}</div>
                    <div>發票日期：{new Date(invoice.date).toLocaleDateString("zh-TW")}</div>
                    <div>上傳用戶：{invoice.user_name || invoice.user_email || "未知"}</div>
                    <div>上傳時間：{new Date(invoice.created_at).toLocaleString("zh-TW")}</div>
                  </div>
                </div>
              </ItemContent>
              <ItemActions>
                <Link
                  href={invoice.image_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hover:bg-accent"
                  >
                    <DownloadIcon className="w-4 h-4" />
                  </Button>
                </Link>
                <DeleteButton invoiceId={invoice.id} />
              </ItemActions>
            </Item>
          ))
        )}
      </div>
    </div>
  );
}
