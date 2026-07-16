import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";

const isTauri = typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined;
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true" || !isTauri;

if (isDemoMode) {
  console.log("%c[Tauri Mock Mode] Initializing mock system for web showcase...", "color: #3b82f6; font-weight: bold; font-size: 14px;");

  // Pre-seed localStorage with demo data if empty
  if (!localStorage.getItem("feeder_users")) {
    localStorage.setItem("feeder_users", JSON.stringify([
      {
        user_id: 1,
        name: "Kuba",
        number: 10,
        created_at: new Date().toISOString()
      },
      {
        user_id: 2,
        name: "Anička",
        number: 7,
        created_at: new Date().toISOString()
      }
    ]));
  }

  if (!localStorage.getItem("feeder_modes")) {
    localStorage.setItem("feeder_modes", JSON.stringify([
      {
        mode_id: 1,
        name: "Střelba z dálky",
        image: "default.png",
        category: 0,
        predefined: true,
        repetition: 10,
        angles: "[90, 60, 120]",
        distances: "[3500, 3500, 3500]",
        intervals: "[5, 5, 5]"
      },
      {
        mode_id: 2,
        name: "Rychlý trénink",
        image: "default.png",
        category: 1,
        predefined: true,
        repetition: 15,
        angles: "[45, 90, 135]",
        distances: "[3000, 3200, 3000]",
        intervals: "[4, 4, 4]"
      }
    ]));
  }

  if (!localStorage.getItem("feeder_records")) {
    localStorage.setItem("feeder_records", JSON.stringify([
      {
        record_id: 1,
        name: "Střelba z dálky",
        category: 0,
        made: 7,
        taken: 10,
        user_id: 1,
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        record_id: 2,
        name: "Rychlý trénink",
        category: 1,
        made: 11,
        taken: 15,
        user_id: 2,
        created_at: new Date().toISOString()
      }
    ]));
  }

  mockWindows("main");

  // Dynamically import emit after mock setup to prevent circular dependencies or early execution crashes
  let emit;
  import("@tauri-apps/api/event").then(m => {
    emit = m.emit;
  });

  mockIPC(async (cmd, args) => {
    console.log(`[Tauri Mock IPC] Command "${cmd}":`, args);

    switch (cmd) {
      case "load_users": {
        return JSON.parse(localStorage.getItem("feeder_users") || "[]");
      }
      case "add_user": {
        const users = JSON.parse(localStorage.getItem("feeder_users") || "[]");
        const newUser = {
          user_id: Date.now(),
          name: args.name,
          number: args.number,
          created_at: new Date().toISOString()
        };
        users.push(newUser);
        localStorage.setItem("feeder_users", JSON.stringify(users));
        return newUser;
      }
      case "delete_user":
      case "delete_user_permanently": {
        let users = JSON.parse(localStorage.getItem("feeder_users") || "[]");
        users = users.filter(u => u.user_id !== args.userId);
        localStorage.setItem("feeder_users", JSON.stringify(users));
        return null;
      }
      case "rename_user": {
        let users = JSON.parse(localStorage.getItem("feeder_users") || "[]");
        users = users.map(u => u.user_id === args.userId ? { ...u, name: args.newName } : u);
        localStorage.setItem("feeder_users", JSON.stringify(users));
        return null;
      }
      case "select_user": {
        const users = JSON.parse(localStorage.getItem("feeder_users") || "[]");
        const selected = users.find(u => u.user_id === args.userId);
        if (selected) {
          localStorage.setItem("feeder_current_user", JSON.stringify(selected));
        }
        return null;
      }
      case "load_current_data": {
        let currentUser = JSON.parse(localStorage.getItem("feeder_current_user"));
        const users = JSON.parse(localStorage.getItem("feeder_users") || "[]");
        if (!currentUser && users.length > 0) {
          currentUser = users[0];
          localStorage.setItem("feeder_current_user", JSON.stringify(currentUser));
        }
        if (currentUser) {
          return [{
            user_id: currentUser.user_id,
            name: currentUser.name,
            number: currentUser.number,
            last_calibration: localStorage.getItem("feeder_last_calibration") || new Date().toISOString(),
            angle: Number(localStorage.getItem("feeder_angle") || 90)
          }];
        }
        return [];
      }
      case "load_modes": {
        return JSON.parse(localStorage.getItem("feeder_modes") || "[]");
      }
      case "add_mode": {
        const modes = JSON.parse(localStorage.getItem("feeder_modes") || "[]");
        const newMode = {
          mode_id: Date.now(),
          name: args.data.name,
          image: args.data.image || "default.png",
          category: Number(args.data.category || 0),
          predefined: Boolean(args.data.predefined || false),
          repetition: Number(args.data.repetition || 10),
          angles: args.data.angles,
          distances: args.data.distances,
          intervals: args.data.intervals
        };
        modes.push(newMode);
        localStorage.setItem("feeder_modes", JSON.stringify(modes));
        return newMode;
      }
      case "update_mode": {
        const modes = JSON.parse(localStorage.getItem("feeder_modes") || "[]");
        const updated = modes.map(m => m.mode_id === args.data.mode_id ? {
          ...m,
          name: args.data.name,
          image: args.data.image,
          category: Number(args.data.category),
          predefined: Boolean(args.data.predefined),
          repetition: Number(args.data.repetition),
          angles: args.data.angles,
          distances: args.data.distances,
          intervals: args.data.intervals
        } : m);
        localStorage.setItem("feeder_modes", JSON.stringify(updated));
        return null;
      }
      case "delete_mode": {
        let modes = JSON.parse(localStorage.getItem("feeder_modes") || "[]");
        modes = modes.filter(m => m.mode_id !== args.modeId);
        localStorage.setItem("feeder_modes", JSON.stringify(modes));
        return null;
      }
      case "load_records": {
        return JSON.parse(localStorage.getItem("feeder_records") || "[]");
      }
      case "add_record": {
        const records = JSON.parse(localStorage.getItem("feeder_records") || "[]");
        const newRecord = {
          record_id: Date.now(),
          name: args.data.name,
          category: Number(args.data.category || 0),
          made: Number(args.data.made || 0),
          taken: Number(args.data.taken || 0),
          user_id: args.data.user_id,
          created_at: new Date().toISOString()
        };
        records.push(newRecord);
        localStorage.setItem("feeder_records", JSON.stringify(records));
        return newRecord;
      }
      case "get_feeder_env": {
        return {
          VITE_DEVELOPER_MODE_PASSWORD: import.meta.env.VITE_DEVELOPER_MODE_PASSWORD || "adminDejv7",
          VITE_APP_LOCKED: import.meta.env.VITE_APP_LOCKED || "false",
          VITE_ALWAYS_CALIBRATE: import.meta.env.VITE_ALWAYS_CALIBRATE || "false"
        };
      }
      case "save_calibration_state": {
        localStorage.setItem("feeder_calibration_state", String(args.state));
        return null;
      }
      case "save_last_calibration": {
        localStorage.setItem("feeder_last_calibration", args.time || new Date().toISOString());
        return null;
      }
      case "save_angle": {
        localStorage.setItem("feeder_angle", String(args.angle));
        return null;
      }
      case "get_basket_score": {
        return Number(localStorage.getItem("feeder_basket_score") || 0);
      }
      case "reset_basket_score": {
        localStorage.setItem("feeder_basket_score", "0");
        if (emit) {
          emit("basket-score-updated", { score: 0 });
        }
        return 0;
      }
      case "add_basket_points": {
        const delta = Number(args.delta || 1);
        const current = Number(localStorage.getItem("feeder_basket_score") || 0);
        const nextScore = current + delta;
        localStorage.setItem("feeder_basket_score", String(nextScore));
        if (emit) {
          emit("basket-score-updated", { score: nextScore });
        }
        return nextScore;
      }
      case "start_workout": {
        if (emit) {
          emit("state-changed", 1); // 1 = Running
        }
        return null;
      }
      case "pause_workout": {
        if (emit) {
          emit("state-changed", 0); // 0 = Pause
        }
        return null;
      }
      case "exit_workout": {
        if (emit) {
          emit("state-changed", 0); // 0 = Idle
        }
        return null;
      }
      case "rotate_stepper_motor": {
        const requestId = Date.now();
        setTimeout(() => {
          if (emit) {
            emit("motor_move_started", { requestId });
          }
        }, 50);
        setTimeout(() => {
          if (emit) {
            emit("motor_move_completed", { requestId, message: "success" });
          }
        }, 600);
        return { requestId };
      }
      case "calibrate_stepper_motor": {
        const requestId = Date.now();
        setTimeout(() => {
          if (emit) {
            emit("motor_move_started", { requestId });
          }
        }, 50);
        setTimeout(() => {
          if (emit) {
            emit("motor_move_completed", { requestId, message: "end_place" });
          }
        }, 1000);
        return { requestId };
      }
      case "load_archived_users": {
        return [];
      }
      default: {
        return null;
      }
    }
  }, { shouldMockEvents: true });
}
