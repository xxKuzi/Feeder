import React, { useState, useEffect } from "react";
import { CgProfile } from "react-icons/cg";
import { invoke } from "@tauri-apps/api/core";
import { useData } from "../parts/Memory";

import { MdOutlineDeleteForever, MdDriveFileRenameOutline, MdAdd } from "react-icons/md";

export default function Profiles({ isStartup = false, onSelect }) {
  const [editMode, setEditMode] = useState(false);
  const [deleteMode, setDeleteMode] = useState(false);
  
  const [showArchived, setShowArchived] = useState(false);
  const [archivedUsers, setArchivedUsers] = useState([]);

  const { updateProfile, users, loadUsers, openModal, profile } = useData();

  // Load archived users when that view is opened
  const loadArchivedUsers = async () => {
    try {
      const list = await invoke("load_archived_users");
      setArchivedUsers(
        list.map((u) => ({
          userId: u.user_id,
          name: u.name,
          number: u.number,
        }))
      );
    } catch (e) {
      console.error("Failed to load archived users:", e);
    }
  };

  useEffect(() => {
    if (showArchived) {
      loadArchivedUsers();
    }
  }, [showArchived]);

  // Command wrappers
  const selectUser = async (userId) => {
    const userData = users.find((user) => user.userId === userId);
    if (userData) {
      await invoke("select_user", { userId: userId });
      updateProfile(userData);
    }
  };

  const deleteUser = async (deletedUserId) => {
    try {
      await invoke("delete_user", { userId: deletedUserId });
      
      // If we archived the active profile, select a different one
      if (profile?.userId === deletedUserId) {
        const nextActive = users.find((user) => user.userId !== deletedUserId);
        if (nextActive) {
          await selectUser(nextActive.userId);
        }
      }
      loadUsers();
    } catch (error) {
      console.error("Failed to archive user:", error);
      setTimeout(() => {
        openModal({
          headline: "Chyba při archivaci",
          question: error.toString() === "Cannot archive user. At least 2 active users are required."
            ? "Nelze archivovat posledního aktivního hráče. Musíte mít aspoň 2 aktivní hráče."
            : error.toString(),
          buttons: { cancel: true },
        });
      }, 100);
    }
  };

  const renameUser = async (userId, newName, newNumber) => {
    if (/^\d+(\.\d+)?$/.test(newNumber)) {
      await invoke("rename_user", {
        userId: userId,
        newName: newName,
        newNumber: newNumber,
      });
      await loadUsers();
    } else {
      setTimeout(() => {
        openModal({
          headline: "Číslo dresu musí být číslo",
          question: "Upravte číslo dresu aby se jednalo o číslo",
          buttons: { cancel: true },
        });
      }, 100);
    }
  };

  // Open "Add User" popup modal using standard input modal
  const openAddUserModal = () => {
    openModal({
      buttons: {
        confirm: true,
        cancel: true,
      },
      headline: "Přidat hráče",
      question: "Zadejte jméno nového hráče a jeho číslo dresu:",
      input: true,
      numberOfInputs: 2,
      inputData: { name: "", number: "" },
      inputPlaceholders: ["name", "number"],
      placeholders: ["Jméno hráče", "Číslo dresu"],
      confirmHandle: async (newData) => {
        if (!newData.name || !newData.number) return;
        if (/^\d+(\.\d+)?$/.test(newData.number)) {
          try {
            await invoke("add_user", {
              name:
                newData.name.substring(0, 1).toUpperCase() +
                newData.name.slice(1),
              number: Number(newData.number),
            });
            loadUsers();
          } catch (error) {
            console.error("Failed to add user:", error);
          }
        } else {
          setTimeout(() => {
            openModal({
              headline: "Číslo dresu musí být číslo",
              question: "Upravte číslo dresu aby se jednalo o číslo",
              buttons: { cancel: true },
            });
          }, 100);
        }
      },
    });
  };

  const confirmArchiveUser = (user) => {
    openModal({
      buttons: {
        confirm: true,
        cancel: true,
      },
      headline: "Smazat profil hráče",
      question: `Opravdu chcete smazat profil hráče ${user.name}? a jeho statistiky?`,
      confirmHandle: () => {
        deleteUser(user.userId);
      },
    });
  };

  const confirmRestoreUser = (user) => {
    openModal({
      buttons: {
        confirm: true,
        cancel: true,
      },
      headline: "Obnovit hráče",
      question: `Opravdu chcete obnovit hráče ${user.name} zpět mezi aktivní profily?`,
      confirmHandle: async () => {
        try {
          await invoke("unarchive_user", { userId: user.userId });
          loadUsers();
          loadArchivedUsers();
        } catch (error) {
          console.error("Failed to restore user:", error);
        }
      },
    });
  };

  const confirmDeleteForever = (user) => {
    openModal({
      buttons: {
        confirm: true,
        cancel: true,
      },
      headline: "Smazat hráče navždy",
      question: `Opravdu chcete NAVŽDY smazat hráče ${user.name}? Všechny jeho tréninkové statistiky a záznamy budou trvale odstraněny. Tato akce je nevratná.`,
      confirmHandle: async () => {
        try {
          await invoke("delete_user_permanently", { userId: user.userId });
          loadArchivedUsers();
          loadUsers();
        } catch (error) {
          console.error("Failed to delete user permanently:", error);
        }
      },
    });
  };

  const handleUserClick = async (user) => {
    if (editMode) {
      openModal({
        buttons: {
          confirm: true,
          cancel: true,
        },
        headline: "Změna dat",
        question: "Můžeš si profil přejmenovat nebo si změnit číslo dresu",
        input: true,
        numberOfInputs: 2,
        inputData: { name: user.name, number: user.number },
        inputPlaceholders: ["name", "number"],
        placeholders: ["Jméno hráče", "Číslo dresu"],
        confirmHandle: (newData) => {
          renameUser(
            user.userId,
            newData["name"],
            Number(newData["number"])
          );
        },
      });
    } else if (deleteMode) {
      confirmArchiveUser(user);
    } else {
      // Normal click: select and proceed
      await selectUser(user.userId);
      if (isStartup && onSelect) {
        onSelect();
      }
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full items-center justify-center bg-white text-gray-900 overflow-hidden select-none animate-fadeIn">
      {/* Inline Styles for iOS Shaking */}
      <style>{`
        @keyframes shake {
          0% { transform: translate(0.5px, 0.5px) rotate(0deg); }
          10% { transform: translate(-0.5px, -0.5px) rotate(-0.1deg); }
          20% { transform: translate(-1px, 0px) rotate(0.1deg); }
          30% { transform: translate(0px, 0.5px) rotate(0deg); }
          40% { transform: translate(0.5px, -0.5px) rotate(0.1deg); }
          50% { transform: translate(-0.5px, 0.5px) rotate(-0.1deg); }
          60% { transform: translate(-1px, 0px) rotate(0deg); }
          70% { transform: translate(0.5px, 0.5px) rotate(-0.1deg); }
          80% { transform: translate(-0.5px, -0.5px) rotate(0.1deg); }
          90% { transform: translate(0.5px, 0.5px) rotate(0deg); }
          100% { transform: translate(0.5px, -0.5px) rotate(-0.1deg); }
        }
        .animate-shake {
          animation: shake 0.3s infinite;
        }
      `}</style>

      {/* Screen Title */}
      <p className="text-5xl font-bold tracking-wide mb-2 select-none">
        {isStartup ? "Kdo bude střílet?" : "Profily"}
      </p>
      <p className="text-gray-500 text-lg mb-4 select-none">
        {isStartup
          ? "Kliknutím vyberte profil hráče pro dnešní trénink"
          : "Spravujte profily hráčů nebo vyberte aktivního hráče"}
      </p>

      {/* Control Buttons (Top Right Corner) */}
      <div className="absolute right-8 top-8 flex items-center gap-4 z-30">
        {/* Plus Button */}
        <button
          onClick={openAddUserModal}
          className="p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-[0_4px_20px_rgba(37,99,235,0.3)] transition-all hover:scale-110 active:scale-95 duration-200 cursor-pointer"
          title="Přidat hráče"
        >
          <MdAdd size={28} />
        </button>

        {/* Edit Button */}
        <button
          onClick={() => {
            setEditMode(!editMode);
            setDeleteMode(false);
          }}
          className={`p-4 rounded-full border shadow-md transition-all hover:scale-110 active:scale-95 duration-200 cursor-pointer ${
            editMode
              ? "bg-green-600 text-white border-green-600 shadow-[0_4px_20px_rgba(22,163,74,0.3)]"
              : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:text-gray-900"
          }`}
          title="Upravit hráče"
        >
          <MdDriveFileRenameOutline size={28} />
        </button>

        {/* Delete/Archive Button */}
        <button
          onClick={() => {
            setDeleteMode(!deleteMode);
            setEditMode(false);
          }}
          className={`p-4 rounded-full border shadow-md transition-all hover:scale-110 active:scale-95 duration-200 cursor-pointer ${
            deleteMode
              ? "bg-red-600 text-white border-red-600 shadow-[0_4px_20px_rgba(220,38,38,0.3)]"
              : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:text-gray-900"
          }`}
          title="Archivovat hráče"
        >
          <MdOutlineDeleteForever size={28} />
        </button>
      </div>

      {/* Bubble Arena Container (Light theme grid cloud layout - distanced and scrollable) */}
      <div
        className="relative w-[90vw] h-[65vh] border-2 border-gray-200 bg-gray-50/50 backdrop-blur-sm rounded-3xl overflow-y-auto mt-2 p-10 flex flex-wrap gap-4 justify-center items-center shadow-inner"
      >
        {users
          .filter((u) => u.name !== "XYZ")
          .map((user) => {
            const isActive = !isStartup && user.userId === profile?.userId;

            // Determine dimensions for a balanced visual bubble cloud
            let diameter = 130; // default size
            if (isActive) {
              diameter = 180; // active profile is larger
            } else {
              const modVal = (user.userId || 0) % 3;
              if (modVal === 0) diameter = 110;
              else if (modVal === 1) diameter = 135;
              else diameter = 155;
            }

            return (
              <div
                key={user.userId}
                className="flex items-center justify-center w-[190px] h-[190px] shrink-0"
              >
                <button
                  onClick={() => handleUserClick(user)}
                  style={{
                    width: `${diameter}px`,
                    height: `${diameter}px`,
                  }}
                  className={`flex flex-col items-center justify-center rounded-full border-2 transition-all duration-200 select-none cursor-pointer relative
                    ${
                      isActive
                        ? "bg-gradient-to-br from-blue-600 to-indigo-600 border-blue-400 shadow-[0_4px_25px_rgba(37,99,235,0.5)] text-white scale-105"
                        : "bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-400 text-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                    }
                    ${deleteMode ? "animate-shake border-red-500 shadow-[0_0_15px_rgba(220,38,38,0.2)]" : ""}
                    ${editMode ? "border-green-500 shadow-[0_0_15px_rgba(22,163,74,0.2)]" : ""}
                    hover:scale-105 active:scale-95
                  `}
                >
                  <CgProfile size={diameter > 140 ? 44 : 32} className={`${isActive ? "text-white" : "text-gray-500"}`} />
                  <p className="font-bold text-xl mt-1 tracking-tight">
                    {"#" + user.number}
                  </p>
                  <p className={`font-semibold text-xs max-w-[85%] truncate text-center ${isActive ? "text-white" : "text-gray-600"}`}>
                    {user.name}
                  </p>

                  {/* Badge Overlays for Active Modes */}
                  {deleteMode && (
                    <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1.5 border-2 border-white shadow-md z-10">
                      <MdOutlineDeleteForever size={16} />
                    </div>
                  )}
                  {editMode && (
                    <div className="absolute -top-1 -right-1 bg-green-600 text-white rounded-full p-1.5 border-2 border-white shadow-md z-10">
                      <MdDriveFileRenameOutline size={16} />
                    </div>
                  )}
                </button>
              </div>
            );
          })}
      </div>

      {/* Archive Trigger (Bottom Right Corner) */}
      {!isStartup && (
        <button
          onClick={() => setShowArchived(true)}
          className="absolute right-8 bottom-8 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-white rounded-xl shadow-md border border-gray-200 transition-all font-semibold z-30 cursor-pointer"
        >
          Archivovaní hráči
        </button>
      )}

      {/* Archived List Panel Modal */}
      {showArchived && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-40 transition-opacity duration-300">
          <div className="bg-white border border-gray-200 rounded-3xl w-[80vw] h-[80vh] p-8 flex flex-col relative shadow-2xl text-gray-900">
            <h2 className="text-4xl font-bold mb-2 text-center text-gray-900 tracking-wide">
              Archivovaní hráči
            </h2>
            <p className="text-gray-500 text-center mb-8">
              Kliknutím na hráče ho obnovíte zpět do aktivních profilů
            </p>

            <button
              onClick={() => setShowArchived(false)}
              className="absolute right-6 top-6 text-gray-400 hover:text-gray-700 text-3xl font-light p-2 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 p-4">
              {archivedUsers.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center text-gray-400 text-xl mt-16 gap-2">
                  <CgProfile size={64} className="opacity-30" />
                  <p>Žádní archivovaní hráči.</p>
                </div>
              ) : (
                archivedUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm relative group w-[180px] shrink-0"
                  >
                    <CgProfile
                      size={54}
                      className="text-gray-400"
                    />
                    <p className="font-bold text-lg text-gray-900 mt-2 select-none">
                      {"#" + user.number}
                    </p>
                    <p className="font-semibold text-md text-gray-700 mt-1 truncate max-w-full text-center select-none">
                      {user.name}
                    </p>
                    
                    <div className="flex gap-2 w-full mt-4">
                      {/* Restore Button */}
                      <button
                        onClick={() => confirmRestoreUser(user)}
                        className="flex-1 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer text-center select-none"
                      >
                        Obnovit
                      </button>
                      {/* Delete Forever Button */}
                      <button
                        onClick={() => confirmDeleteForever(user)}
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                        title="Smazat navždy"
                      >
                        <MdOutlineDeleteForever size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
