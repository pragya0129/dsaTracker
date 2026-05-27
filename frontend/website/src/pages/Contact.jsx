import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Contact.css";
import toast from "react-hot-toast";

function Contact() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!name.trim() || !email.trim() || !message.trim()) {

            toast.error("Please fill all fields.");

            return;
        }

        toast.success("Message submitted successfully!");

        setName("");
        setEmail("");
        setMessage("");
    };

    return (
        <div className="contact-page">

            <div className="contact-grid"></div>

            {/* HERO */}
            <section className="contact-container">

                {/* LEFT */}
                <div className="contact-left contact-reveal">

                    <div className="contact-badge">
                        💌 contact the team
                    </div>

                    <h1 className="contact-title">
                        We'd love to hear
                        <span> from you.</span>
                    </h1>

                    <p className="contact-subtitle">
                        Have questions, feature requests,
                        bug reports, or collaboration ideas?
                        Reach out to the AlgoSprint team
                        and we’ll get back to you shortly.
                    </p>

                    <div className="contact-pills">

                        <div className="contact-pill">
                            ⚡ Usually replies within 24 hrs
                        </div>

                        <div className="contact-pill">
                            🚀 Open-source friendly
                        </div>

                        <div className="contact-pill">
                            💬 Feature requests welcome
                        </div>

                        <div className="contact-pill">
                            🤝 Collaboration friendly
                        </div>

                    </div>

                </div>

                {/* RIGHT */}
                <div className="contact-right contact-reveal contact-reveal-delay-2">

                    <div className="contact-form-card">

                        <h2 className="contact-form-title">
                            Send a message
                        </h2>


                        <form className="contact-form" onSubmit={handleSubmit}>

                            <div className="contact-input-group">
                                <label>Name</label>

                                <input
                                    type="text"
                                    className="contact-input"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                />
                            </div>

                            <div className="contact-input-group">
                                <label>Email</label>

                                <input
                                    type="email"
                                    className="contact-input"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>



                            <div className="contact-input-group">
                                <label>Message</label>

                                <textarea
                                    className="contact-textarea"
                                    placeholder="Write your message..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                className="contact-submit"
                            >
                                Send Message →
                            </button>

                        </form>

                    </div>

                </div>

            </section>

        </div>
    );
}

export default Contact;