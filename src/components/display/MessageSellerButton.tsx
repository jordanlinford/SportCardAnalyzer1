import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { addDoc, collection, serverTimestamp, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkSpam, recordUserAction, detectSpamContent } from "@/components/display/SpamFilter";

interface MessageSellerButtonProps {
  sellerId: string;
  displayCaseId: string;
  sellerName: string;
}

export function MessageSellerButton({ sellerId, displayCaseId, sellerName }: MessageSellerButtonProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [membershipRequired, setMembershipRequired] = useState(true);
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  // Check if attempting to message self
  const isMessagingSelf = user && user.uid === sellerId;

  // Check if user has sent messages recently (anti-spam measure)
  const handleOpenDialog = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    
    // Prevent messaging yourself
    if (isMessagingSelf) {
      toast.error("You cannot send a message to yourself");
      return;
    }
    
    if (cooldown) {
      toast.error("Please wait before sending another message");
      return;
    }
    
    // Verify seller exists before opening dialog
    try {
      const sellerRef = doc(db, "users", sellerId);
      const sellerSnap = await getDoc(sellerRef);
      
      if (!sellerSnap.exists()) {
        toast.error("Unable to message: Seller account not found");
        return;
      }
      
      setIsOpen(true);
    } catch (error) {
      console.error("Error checking seller:", error);
      toast.error("Error verifying seller account");
    }
  };

  const sendMessage = async () => {
    if (!user) {
      setShowAuthDialog(true);
      return;
    }
    
    // Prevent messaging yourself
    if (isMessagingSelf) {
      toast.error("You cannot send a message to yourself");
      return;
    }

    if (!message.trim() || !subject.trim()) {
      toast.error("Please enter both subject and message");
      return;
    }

    // Prevent spam with message length limits
    if (message.length > 500) {
      toast.error("Message is too long (500 character limit)");
      return;
    }

    try {
      setIsSending(true);
      
      // Check for spam behavior
      const isSpam = await checkSpam({
        userId: user.uid,
        actionType: 'message',
        cooldownPeriod: 60000, // 1 minute between messages
        maxActions: 3 // Max 3 messages in 1 minute
      });
      
      if (isSpam) {
        toast.error("Please slow down. You're sending messages too frequently.");
        return;
      }
      
      // Check for spam content with lessened restrictions
      if (detectSpamContent(message) || detectSpamContent(subject)) {
        toast.error("Your message contains inappropriate content.");
        return;
      }
      
      // First verify the seller exists - Critical for permissions to work!
      const sellerRef = doc(db, "users", sellerId);
      const sellerSnap = await getDoc(sellerRef);
      
      if (!sellerSnap.exists()) {
        toast.error("Unable to send message: Recipient not found");
        return;
      }
      
      // Verify the display case exists
      let displayCaseName = "Unknown Display Case";
      let displayCaseExists = false;
      
      try {
        const publicRef = doc(db, "public_display_cases", displayCaseId);
        const publicDoc = await getDoc(publicRef);
        
        if (publicDoc.exists()) {
          displayCaseName = publicDoc.data().name || "Unnamed Display Case";
          displayCaseExists = true;
        } else {
          const legacyRef = doc(db, "displayCases", displayCaseId);
          const legacyDoc = await getDoc(legacyRef);
          
          if (legacyDoc.exists()) {
            displayCaseName = legacyDoc.data().name || "Unnamed Display Case";
            displayCaseExists = true;
          }
        }
      } catch (error) {
        console.error("Error verifying display case:", error);
      }
      
      if (!displayCaseExists) {
        toast.error("Unable to send message: Display case not found");
        return;
      }
      
      // Add message to Firestore with proper error handling
      try {
        // Prepare message data
        const messageData = {
          senderId: user.uid,
          senderName: user.displayName || "Anonymous",
          senderEmail: user.email,
          recipientId: sellerId,
          displayCaseId,
          displayCaseName,
          subject: subject.trim(),
          message: message.trim(),
          timestamp: serverTimestamp(),
          read: false,
          deleted: false // Explicitly set deleted flag to false for new messages
        };
        
        console.log(`Sending message to user ${sellerId} about display case ${displayCaseId}`);
        
        // Add to messages collection
        const messageDocRef = await addDoc(collection(db, "messages"), messageData);
        
        console.log(`Message sent successfully with ID: ${messageDocRef.id}`);
        
        // Record this action for spam prevention
        await recordUserAction(user.uid, 'message', sellerId);
        
        toast.success("Message sent successfully");
        setMessage("");
        setSubject("");
        setIsOpen(false);
        
        // Set cooldown to prevent spam
        setCooldown(true);
        setTimeout(() => setCooldown(false), 30000); // 30 second cooldown
      } catch (error: any) {
        console.error("Error sending message:", error);
        const errorMsg = error?.message || "Unknown error";
        const errorCode = error?.code || "unknown";
        
        if (errorMsg.includes("permission") || errorCode === "permission-denied" || errorMsg.includes("Missing or insufficient permissions")) {
          toast.error("Permission denied: Make sure you're signed in with the correct account");
        } else if (errorCode === "unavailable" || errorMsg.includes("network")) {
          toast.error("Network error: Please check your internet connection and try again");
        } else {
          toast.error(`Failed to send message. Please try again later.`);
        }
      }
    } catch (error: any) {
      console.error("Error in message preparation:", error);
      toast.error(`Error preparing message: ${error?.message || 'Unknown error'}`);
    } finally {
      setIsSending(false);
    }
  };

  // If this is your own display case, show an owner badge instead of message button
  if (isMessagingSelf) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        className="flex items-center gap-2 opacity-70 cursor-default"
        disabled
      >
        <ShieldCheck className="w-4 h-4" />
        Your Display Case
      </Button>
    );
  }

  if (!user && membershipRequired) {
    return (
      <>
        <Button 
          onClick={() => setShowAuthDialog(true)}
          variant="outline" 
          size="sm"
          className="flex items-center gap-2 opacity-70"
        >
          <ShieldAlert className="w-4 h-4" />
          Members Only
        </Button>

        {/* Sign In Dialog */}
        <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Sign in required</DialogTitle>
              <DialogDescription>
                Please sign in or create an account to message {sellerName} about this display case.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                onClick={() => setShowAuthDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // Redirect to login page
                  window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
                }}
              >
                Sign in / Create Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <Button 
        onClick={handleOpenDialog}
        variant="outline" 
        size="sm"
        className="flex items-center gap-2"
        disabled={cooldown}
      >
        <MessageCircle className="w-4 h-4" />
        Message Seller
      </Button>

      {/* Sign In Dialog for authenticated message flow */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Sign in required</DialogTitle>
            <DialogDescription>
              Please sign in or create an account to message sellers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 justify-end">
            <Button 
              variant="outline" 
              onClick={() => setShowAuthDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Redirect to login page
                window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
              }}
            >
              Sign in / Create Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send message to {sellerName}</DialogTitle>
            <DialogDescription>
              Ask a question about this display case or its cards.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                Subject
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
                className="col-span-3"
                maxLength={100}
                disabled={isSending}
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="message" className="text-right">
                Message
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
                className="col-span-3"
                rows={5}
                maxLength={500}
                disabled={isSending}
              />
            </div>
            
            <div className="col-span-full text-xs text-gray-500 text-right">
              {message.length}/500 characters
            </div>
          </div>
          
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button 
              onClick={sendMessage} 
              disabled={isSending || !message.trim() || !subject.trim()}
            >
              {isSending ? "Sending..." : "Send Message"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
} 