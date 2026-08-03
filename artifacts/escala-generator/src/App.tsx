import { useState } from "react";
import { HomePage } from "./pages/home";
import { OperationalSchedulePage } from "./pages/operational-schedule";
import { VerticalPlaceholderPage } from "./pages/vertical-placeholder";
import { WikiPlaceholderPage } from "./pages/wiki-placeholder";

type ActiveModule = "home" | "operational" | "vertical" | "wiki";

function App() {
  const [activeModule, setActiveModule] = useState<ActiveModule>("home");

  if (activeModule === "operational") {
    return <OperationalSchedulePage onBackHome={() => setActiveModule("home")} />;
  }

  if (activeModule === "vertical") {
    return <VerticalPlaceholderPage onBackHome={() => setActiveModule("home")} />;
  }

  if (activeModule === "wiki") {
    return <WikiPlaceholderPage onBackHome={() => setActiveModule("home")} />;
  }

  return (
    <HomePage
      onOpenOperational={() => setActiveModule("operational")}
      onOpenVertical={() => setActiveModule("vertical")}
      onOpenWiki={() => setActiveModule("wiki")}
    />
  );
}

export default App;
