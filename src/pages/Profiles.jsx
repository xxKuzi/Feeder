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
  const [users, setUsers] = useState([{ name: "XYZ" }]);

  const { updateProfile, profile } = useData();

  useEffect(() => {
    loadUsers(); // Fetch users on component mount
  }, []);

  useEffect(() => {
    //for updating state of profile after rename
    if (users[0].name !== "XYZ") {
      const userData = users.find((user) => user.userId === profile.userId);
      updateProfile({ name: userData.name, userId: userData.userId });
    }
  }, [users]);

  const loadUsers = async () => {
    try {
      const userListRust = await invoke("load_users", {}); // Call the Rust command expecting an array of users
      const userList = userListRust.map((user) => ({
        userId: user.user_id,
        name: user.name,
        number: user.number,
        createdAt: user.created_at,
      }));

      setUsers(userList); // Assuming setUsers is set up to handle an array of user objects
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const updateNewUserData = (type, value) => {
    setNewUserData((prev) => ({ ...prev, [type]: value }));
  };

  async function deleteUser(userId) {
    try {
      await invoke("delete_user", { userId: userId });
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
    loadUsers();
  }

  const renameUser = async (userId, newName) => {
    await invoke("rename_user", { userId: userId, newName: newName });
    await loadUsers();
  };

  async function addUser() {
    try {
      await invoke("add_user", {
        name: newUserData.name,
        number: Number(newUserData.number),
      });

      console.log("User added successfully");
    } catch (error) {
      console.error("Failed to add user:", error);
    }
    loadUsers();
  }

  const selectUser = async (userId) => {
    const userData = users.find((user) => user.userId === userId);
    await invoke("select_user", { userId: userId });
    updateProfile(userData);
  };
  return (
    <div className="flex flex-col items-center justify-center w-screen">
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
                onClick={() =>
                  modalRef.current.openModal({
                    confirmButton: "Rename",
                    headline: "Rename",
                    question: "Chose new name",
                    color: "submit",
                    input: true,
                    onConfirm: (inputValue) => {
                      renameUser(user.userId, inputValue);
                    },
                  })
                }
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
