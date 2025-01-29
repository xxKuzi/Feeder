import React, { useState, useEffect, useRef } from "react";
import { CgProfile } from "react-icons/cg";
import { invoke } from "@tauri-apps/api/core";
import { useData } from "../parts/Memory";
import Modal from "../components/Modal.jsx";

import { MdOutlineDeleteForever } from "react-icons/md";
import { MdDriveFileRenameOutline } from "react-icons/md";

export default function Profiles() {
  const modalRef = useRef();
  const [newUserData, setNewUserData] = useState({});

  const { updateProfile, users, loadUsers } = useData();

  const updateNewUserData = (type, value) => {
    setNewUserData((prev) => ({ ...prev, [type]: value }));
  };

  async function deleteUser(deletedUserId) {
    try {
      await invoke("delete_user", { userId: deletedUserId });
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
    let newCurrentUser = users.find(
      (user) => user.userId !== deletedUserId
    ).userId; //random selected user
    selectUser(newCurrentUser); //delete user would be selected
    loadUsers();
  }

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
        modalRef.current.openModal({
          headline: "Číslo dresu musí být číslo",
          question: "Upravte číslo dresu aby se jednalo o číslo",
          buttons: { cancel: true },
        });
      }, 100);
    }
  };

  async function addUser() {
    if (/^\d+(\.\d+)?$/.test(newUserData.number)) {
      //Check if it is number
      try {
        await invoke("add_user", {
          name:
            newUserData.name.substring(0, 1).toUpperCase() +
            newUserData.name.slice(1),
          number: Number(newUserData.number),
        });

        console.log("User added successfully");
      } catch (error) {
        console.error("Failed to add user:", error);
      }
      loadUsers();
    } else {
      modalRef.current.openModal({
        headline: "Číslo dresu musí být číslo",
        question: "Upravte číslo dresu aby se jednalo o číslo",
        buttons: { cancel: true },
      });
    }
  }

  const selectUser = async (userId) => {
    const userData = users.find((user) => user.userId === userId);
    await invoke("select_user", { userId: userId });
    updateProfile(userData);
  };
  return (
    <div className="flex flex-col h-screen items-center justify-center">
      <p className="text-5xl font-semibold">Profily</p>

      <div className="flex items-center justify-center mt-8 gap-4">
        {users.map((user) => (
          <div
            className="flex items-center flex-col justify-center relative"
            key={user.userId}
          >
            <button onClick={() => selectUser(user.userId, user.name)}>
              <div className="flex flex-col items-center justify-center h-[30vh] w-[30vh] rounded-full border-2">
                <CgProfile size={80} />
                <p className="font-semibold text-xl">{"#" + user.number}</p>
              </div>
              <p className="mt-2 text-2xl font-semibold">{user.name}</p>
            </button>

            <div className="flex items-center justify-center">
              <button className="" onClick={() => deleteUser(user.userId)}>
                <MdOutlineDeleteForever size={30} />
              </button>
              <button
                className=""
                onClick={() => {
                  const inputArr = [user.name, user.number];
                  modalRef.current.openModal({
                    buttons: {
                      confirm: true,
                      cancel: true,
                    },

                    headline: "Changing Data",
                    question: "Chose new data",

                    input: true,
                    numberOfInputs: 2,
                    inputData: { name: user.name, number: user.number },
                    inputPlaceholders: ["name", "number"],
                    confirmHandle: (newData) => {
                      renameUser(
                        user.userId,
                        newData["name"],
                        Number(newData["number"])
                      );
                    },
                  });
                }}
              >
                <MdDriveFileRenameOutline size={30} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 w-[70vw] border"></div>
      <p className="text-3xl font-semibold mt-4">Přidat hráče</p>
      <input
        className="mt-6 input__normal"
        value={newUserData.name}
        onChange={(e) => updateNewUserData("name", e.target.value)}
        placeholder="Jméno"
      />
      <input
        className="mt-1 input__normal"
        value={newUserData.number}
        onChange={(e) => updateNewUserData("number", e.target.value)}
        placeholder="Číslo dresu"
      />
      <button
        className="button mt-6 shadow-md button__submit"
        onClick={addUser} // Example number
      >
        Přidat
      </button>
      <Modal ref={modalRef} />
    </div>
  );
}
