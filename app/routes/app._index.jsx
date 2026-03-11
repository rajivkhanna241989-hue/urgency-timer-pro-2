import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query {
      currentAppInstallation {
        metafields(first: 10, namespace: "low_stock_bar") {
          edges {
            node {
              key
              value
            }
          }
        }
      }
    }
  `);

  const data = await response.json();
  const metafields = data.data.currentAppInstallation.metafields.edges;

  const settings = {};
  metafields.forEach(({ node }) => {
    settings[node.key] = node.value;
  });

  return {
    barColor: settings.bar_color || "#e74c3c",
    textColor: settings.text_color || "#c0392b",
    barBackground: settings.bar_background || "#e0e0e0",
    barHeight: settings.bar_height || "10",
    messageText: settings.message_text || "⚠️ Only NUMBER left in stock — order soon!",
  };
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const barColor = formData.get("barColor");
  const textColor = formData.get("textColor");
  const barBackground = formData.get("barBackground");
  const barHeight = formData.get("barHeight");
  const messageText = formData.get("messageText");

  const appInstallationResponse = await admin.graphql(`
    #graphql
    query {
      currentAppInstallation {
        id
      }
    }
  `);

  const appInstallationData = await appInstallationResponse.json();
  const appInstallationId = appInstallationData.data.currentAppInstallation.id;

  await admin.graphql(`
    #graphql
    mutation UpdateSettings($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          key
          value
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      metafields: [
        { ownerId: appInstallationId, namespace: "low_stock_bar", key: "bar_color", value: barColor, type: "single_line_text_field" },
        { ownerId: appInstallationId, namespace: "low_stock_bar", key: "text_color", value: textColor, type: "single_line_text_field" },
        { ownerId: appInstallationId, namespace: "low_stock_bar", key: "bar_background", value: barBackground, type: "single_line_text_field" },
        { ownerId: appInstallationId, namespace: "low_stock_bar", key: "bar_height", value: barHeight, type: "single_line_text_field" },
        { ownerId: appInstallationId, namespace: "low_stock_bar", key: "message_text", value: messageText, type: "single_line_text_field" },
      ],
    },
  });

  return { success: true };
};

export default function Index() {
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [barColor, setBarColor] = useState("#e74c3c");
  const [textColor, setTextColor] = useState("#c0392b");
  const [barBackground, setBarBackground] = useState("#e0e0e0");
  const [barHeight, setBarHeight] = useState("10");
  const [messageText, setMessageText] = useState("⚠️ Only NUMBER left in stock — order soon!");

  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (fetcher.data && !fetcher.data.success) {
      setBarColor(fetcher.data.barColor);
      setTextColor(fetcher.data.textColor);
      setBarBackground(fetcher.data.barBackground);
      setBarHeight(fetcher.data.barHeight);
      setMessageText(fetcher.data.messageText);
    }
  }, [fetcher.data]);

  useEffect(() => {
    if (fetcher.data?.success) {
      shopify.toast.show("Settings saved!");
    }
  }, [fetcher.data?.success]);

  const previewMessage = messageText.replace("NUMBER", "5");
  const fillPercent = Math.round((5 / 20) * 100);

  const handleSave = () => {
    fetcher.submit(
      { barColor, textColor, barBackground, barHeight, messageText },
      { method: "POST" }
    );
  };

  return (
    <s-page heading="Low Stock Bar Settings">
      <s-button slot="primary-action" onClick={handleSave} loading={isLoading}>
        Save Settings
      </s-button>

      <s-section heading="Customise Your Low Stock Bar">
        <s-stack direction="block" gap="base">

          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Bar Fill Colour</s-text>
            <input
              type="color"
              value={barColor}
              onChange={(e) => setBarColor(e.target.value)}
              style={{ width: "60px", height: "40px", cursor: "pointer", border: "none", borderRadius: "8px" }}
            />
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Text Colour</s-text>
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              style={{ width: "60px", height: "40px", cursor: "pointer", border: "none", borderRadius: "8px" }}
            />
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Bar Background Colour</s-text>
            <input
              type="color"
              value={barBackground}
              onChange={(e) => setBarBackground(e.target.value)}
              style={{ width: "60px", height: "40px", cursor: "pointer", border: "none", borderRadius: "8px" }}
            />
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Bar Height: {barHeight}px</s-text>
            <input
              type="range"
              min="4"
              max="20"
              step="2"
              value={barHeight}
              onChange={(e) => setBarHeight(e.target.value)}
              style={{ width: "200px" }}
            />
          </s-stack>

          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Message Text (use NUMBER as placeholder for stock count)</s-text>
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #ccc", fontSize: "14px" }}
            />
          </s-stack>

        </s-stack>
      </s-section>

      <s-section heading="Live Preview">
        <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "12px" }}>
          <p style={{ fontSize: "13px", fontWeight: "700", color: textColor, margin: "0 0 6px 0" }}>
            {previewMessage}
          </p>
          <div style={{ background: barBackground, borderRadius: "999px", height: `${barHeight}px`, width: "100%", overflow: "hidden" }}>
            <div style={{ background: barColor, height: `${barHeight}px`, width: `${fillPercent}%`, borderRadius: "999px" }}></div>
          </div>
        </div>
      </s-section>

    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};